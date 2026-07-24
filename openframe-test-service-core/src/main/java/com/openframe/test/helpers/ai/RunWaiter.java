package com.openframe.test.helpers.ai;

import com.openframe.test.api.ApprovalApi;
import com.openframe.test.api.MessageApi;
import com.openframe.test.data.dto.ai.ChatType;
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
 * <p><b>The race this solves:</b> {@code dialog.streamState} is derived from a Redis lock the async run
 * acquires <em>after</em> {@code POST /messages} returns, so it reads {@code IDLE} immediately after
 * send — a naive "poll until IDLE" passes instantly against an empty conversation. Instead we wait for
 * a real terminal marker: an ASSISTANT message carrying a TEXT entry, created strictly after the last
 * action (the user prompt, or the most recent approval we granted), with no approval still pending.
 */
@Slf4j
public class RunWaiter {

    public static final int DEFAULT_TIMEOUT_SECONDS = 180;
    private static final long POLL_INTERVAL_MS = 3000;
    private static final int PAGE_LIMIT = 50;

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
        Instant lastActionAt = userSentAt;
        long deadline = System.nanoTime() + timeoutSeconds * 1_000_000_000L;

        while (true) {
            List<Message> ordered = fetchOrdered(dialogId, chatType);

            // Drive the approval gate first, so the terminal check sees the post-approval world.
            for (Message m : ordered) {
                Instant at = parseInstant(m.getCreatedAt());
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
                    lastActionAt = latest(lastActionAt, at);
                }
            }

            boolean approvalPending = ordered.stream()
                    .flatMap(m -> dataOf(m, MessageDataType.APPROVAL_REQUEST).stream())
                    .anyMatch(d -> d.getApprovalRequestId() != null && !handledApprovals.contains(d.getApprovalRequestId()));

            if (!approvalPending && hasTerminalAssistantText(ordered, lastActionAt)) {
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

    private boolean hasTerminalAssistantText(List<Message> ordered, Instant after) {
        return ordered.stream().anyMatch(m ->
                m.getOwner() != null
                        && m.getOwner().getType() == MessageOwnerType.ASSISTANT
                        && parseInstant(m.getCreatedAt()).isAfter(after)
                        && dataOf(m, MessageDataType.TEXT).stream()
                        .anyMatch(d -> d.getText() != null && !d.getText().isBlank()));
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

    private static Instant latest(Instant a, Instant b) {
        return a.isAfter(b) ? a : b;
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
