package com.openframe.test.helpers.ai;

import com.openframe.test.api.ApprovalApi;
import com.openframe.test.api.DialogApi;
import com.openframe.test.api.MessageApi;
import com.openframe.test.data.dto.ai.ChatType;
import com.openframe.test.data.dto.ai.DialogStreamState;
import com.openframe.test.data.dto.ai.Message;
import com.openframe.test.data.dto.ai.MessageConnection;
import com.openframe.test.data.dto.ai.MessageData;
import com.openframe.test.data.dto.ai.MessageDataType;
import com.openframe.test.data.dto.ai.MessageEdge;
import com.openframe.test.data.dto.ai.MessageOwnerType;
import lombok.extern.slf4j.Slf4j;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Waits for an assistant run to reach a terminal state by polling the {@code messages} stream, and
 * drives the approval gate along the way.
 *
 * <p><b>The completion signal.</b> The async run holds a Redis lock for its whole lifetime, so
 * {@code dialog.streamState} reads {@code STREAMING} across every LLM/tool round and flips to
 * {@code IDLE} exactly once — when the run finishes. That makes {@code IDLE} the reliable terminal
 * marker. We do <em>not</em> use "an assistant produced text" as the terminal condition: the assistant
 * narrates <em>before</em> acting (a TEXT message, then tool rounds in the same run), so that fires
 * mid-run and cuts the wait short.
 *
 * <p><b>The race this guards.</b> The lock is acquired <em>after</em> {@code POST /messages} returns, so
 * for a brief window right after send {@code streamState} still reads {@code IDLE} against an empty
 * conversation. We therefore require the run to have visibly started (an ASSISTANT message after the
 * prompt) and confirm {@code IDLE} on two consecutive polls before declaring completion; approvals are
 * granted along the way and reset that confirmation.
 */
@Slf4j
public class RunWaiter {

    public static final int DEFAULT_TIMEOUT_SECONDS = 180;
    private static final long POLL_INTERVAL_MS = 3000;
    private static final int PAGE_LIMIT = 50;
    /** Consecutive IDLE observations required before declaring completion (guards the lock-acquire race). */
    private static final int IDLE_CONFIRMATIONS = 2;

    private final int timeoutSeconds;

    public RunWaiter() {
        this(DEFAULT_TIMEOUT_SECONDS);
    }

    public RunWaiter(int timeoutSeconds) {
        this.timeoutSeconds = timeoutSeconds;
    }

    /**
     * Polls until the run is terminal, granting/denying approvals per {@code policy}. Returns the final
     * ordered message list. Throws {@link InfraFailureException} if the run does not complete in time —
     * a dispatch/agent/LLM stall is infrastructure, not a behavioral failure.
     */
    public List<Message> awaitCompletion(String dialogId, ChatType chatType, Instant userSentAt, ApprovalPolicy policy) {
        Set<String> handledApprovals = new HashSet<>();
        long deadline = System.nanoTime() + timeoutSeconds * 1_000_000_000L;
        int idleConfirmations = 0;

        while (true) {
            List<Message> ordered = fetchOrdered(dialogId, chatType);

            // Drive the approval gate first, so the terminal check sees the post-approval world. Granting
            // an approval restarts the run (lock re-acquired), so reset the IDLE confirmation counter.
            for (Message m : ordered) {
                for (MessageData d : dataOf(m, MessageDataType.APPROVAL_REQUEST)) {
                    String reqId = d.getApprovalRequestId();
                    if (reqId == null || handledApprovals.contains(reqId)) {
                        continue;
                    }
                    if (policy == ApprovalPolicy.MANUAL) {
                        log.info("Approval {} pending; returning to test (MANUAL policy)", reqId);
                        return ordered;
                    }
                    boolean approve = policy == ApprovalPolicy.AUTO_APPROVE;
                    log.info("{} approval request {} (command: {})", approve ? "Approving" : "Rejecting", reqId, d.getCommand());
                    ApprovalApi.approve(reqId, approve);
                    handledApprovals.add(reqId);
                    idleConfirmations = 0;
                }
            }

            boolean approvalPending = ordered.stream()
                    .flatMap(m -> dataOf(m, MessageDataType.APPROVAL_REQUEST).stream())
                    .anyMatch(d -> d.getApprovalRequestId() != null && !handledApprovals.contains(d.getApprovalRequestId()));

            // Terminal only when the run has visibly started (guards the lock-acquire race), nothing is
            // waiting on us, and the run's lock has been released (streamState IDLE) on N consecutive polls.
            boolean idleNow = !approvalPending
                    && assistantActivitySeen(ordered, userSentAt)
                    && DialogStreamState.IDLE == streamStateQuietly(dialogId);
            idleConfirmations = idleNow ? idleConfirmations + 1 : 0;

            if (idleConfirmations >= IDLE_CONFIRMATIONS) {
                log.info("Run complete for dialog {}", dialogId);
                return ordered;
            }

            if (System.nanoTime() > deadline) {
                throw new InfraFailureException(String.format(
                        "Assistant run did not complete within %ds for dialog %s. Conversation so far:\n%s",
                        timeoutSeconds, dialogId, new RunResult(ordered)));
            }
            sleep();
        }
    }

    /** streamState is diagnostic plumbing; a transient GraphQL hiccup must not end the wait, so treat errors as "not idle". */
    private DialogStreamState streamStateQuietly(String dialogId) {
        try {
            return DialogApi.streamState(dialogId);
        } catch (RuntimeException e) {
            log.debug("streamState({}) query failed, treating as non-idle: {}", dialogId, e.getMessage());
            return DialogStreamState.STREAMING;
        }
    }

    private List<Message> fetchOrdered(String dialogId, ChatType chatType) {
        MessageConnection connection = MessageApi.getMessages(dialogId, chatType, PAGE_LIMIT);
        List<Message> messages = new ArrayList<>();
        if (connection != null && connection.getEdges() != null) {
            for (MessageEdge edge : connection.getEdges()) {
                if (edge.getNode() != null) {
                    messages.add(edge.getNode());
                }
            }
        }
        messages.sort(Comparator.comparing(m -> parseInstant(m.getCreatedAt())));
        return messages;
    }

    /** True once the run has visibly started: any ASSISTANT message created after the prompt we sent. */
    private boolean assistantActivitySeen(List<Message> ordered, Instant after) {
        return ordered.stream().anyMatch(m ->
                m.getOwner() != null
                        && m.getOwner().getType() == MessageOwnerType.ASSISTANT
                        && parseInstant(m.getCreatedAt()).isAfter(after));
    }

    private static List<MessageData> dataOf(Message m, MessageDataType type) {
        if (m.getMessageData() == null) {
            return List.of();
        }
        List<MessageData> out = new ArrayList<>();
        for (MessageData d : m.getMessageData()) {
            if (d.getType() == type) {
                out.add(d);
            }
        }
        return out;
    }

    private static Instant parseInstant(String iso) {
        if (iso == null || iso.isBlank()) {
            return Instant.EPOCH;
        }
        try {
            return Instant.parse(iso);
        } catch (Exception e) {
            return Instant.EPOCH;
        }
    }

    private void sleep() {
        try {
            Thread.sleep(POLL_INTERVAL_MS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new InfraFailureException("Interrupted while waiting for assistant run", e);
        }
    }
}
