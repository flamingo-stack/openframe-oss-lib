package com.openframe.test.helpers.ai;

import com.openframe.test.api.DialogApi;
import com.openframe.test.api.MessageApi;
import com.openframe.test.data.dto.ai.ChatType;
import com.openframe.test.data.dto.ai.Message;
import com.openframe.test.data.dto.ai.MessageConnection;
import com.openframe.test.data.dto.ai.MessageData;
import com.openframe.test.data.dto.ai.MessageDataType;
import com.openframe.test.data.dto.ai.MessageEdge;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Waits for a compaction to finish. {@code POST /dialogs/{id}/compact} only accepts the request; the agent
 * then writes a CONTEXT_COMPACTION_START message, summarises the history, and writes a
 * CONTEXT_COMPACTION_END message carrying the summary. Both are ordinary chat messages, so this polls the
 * message list rather than the run lease, which a compaction does not report through {@link RunWaiter}.
 */
@Slf4j
public class CompactionWaiter {

    private static final int TIMEOUT_SECONDS = 120;
    private static final long POLL_INTERVAL_MS = 2000;
    private static final int PAGE_SIZE = 100;
    private static final int IDLE_ATTEMPTS = 8;

    /**
     * Requests a compaction right after a reply, returning the final status. A 409 here means the run that
     * just answered has not released the dialog yet, so only that status is retried, briefly; any other
     * status is returned as it came.
     */
    public static int requestWhenIdle(String dialogId) {
        int status = DialogApi.compact(dialogId);
        for (int attempt = 1; status == 409 && attempt < IDLE_ATTEMPTS; attempt++) {
            sleep();
            status = DialogApi.compact(dialogId);
        }
        return status;
    }

    /** Blocks until the dialog's compaction has finished, and returns the summary it produced. */
    public static String awaitSummary(String dialogId, ChatType chatType) {
        long deadline = System.nanoTime() + TIMEOUT_SECONDS * 1_000_000_000L;
        List<MessageData> data = List.of();
        while (System.nanoTime() < deadline) {
            data = compactionData(dialogId, chatType);
            MessageData end = last(data, MessageDataType.CONTEXT_COMPACTION_END);
            if (end != null) {
                assertThat(last(data, MessageDataType.CONTEXT_COMPACTION_START))
                        .as("Compaction of dialog %s ended without the START message that opens it", dialogId)
                        .isNotNull();
                log.info("Compaction of dialog {} finished; summary is {} characters", dialogId,
                        end.getSummary() == null ? 0 : end.getSummary().length());
                return end.getSummary();
            }
            sleep();
        }
        throw new AssertionError(String.format(
                "Compaction of dialog %s did not finish within %ds; compaction messages seen: %s",
                dialogId, TIMEOUT_SECONDS, data.stream().map(MessageData::getType).toList()));
    }

    private static List<MessageData> compactionData(String dialogId, ChatType chatType) {
        MessageConnection connection = MessageApi.getMessages(dialogId, chatType, PAGE_SIZE);
        if (connection == null || connection.getEdges() == null) {
            return List.of();
        }
        return connection.getEdges().stream()
                .map(MessageEdge::getNode)
                .filter(Objects::nonNull)
                .map(Message::getMessageData)
                .filter(Objects::nonNull)
                .flatMap(List::stream)
                .filter(d -> d.getType() == MessageDataType.CONTEXT_COMPACTION_START
                        || d.getType() == MessageDataType.CONTEXT_COMPACTION_END)
                .toList();
    }

    private static MessageData last(List<MessageData> data, MessageDataType type) {
        return data.stream().filter(d -> d.getType() == type).reduce((first, second) -> second).orElse(null);
    }

    private static void sleep() {
        try {
            Thread.sleep(POLL_INTERVAL_MS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new InfraFailureException("Interrupted while waiting for a compaction to finish", e);
        }
    }
}
