package com.openframe.test.helpers.ai;

import com.openframe.test.api.DialogApi;
import com.openframe.test.api.MessageApi;
import com.openframe.test.data.dto.ai.ChatType;
import com.openframe.test.data.dto.ai.DialogStreamState;
import com.openframe.test.data.dto.ai.Message;
import com.openframe.test.data.dto.ai.MessageResponse;
import com.openframe.test.data.dto.ai.SendMessageRequest;
import lombok.extern.slf4j.Slf4j;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Starts a long reply and stops it mid-stream, the way the chat's Stop button does. A stop only raises a
 * flag that the run checks as tokens arrive, so it has to land while the run is streaming: this waits for
 * the dialog to report STREAMING and for some text to have been produced before stopping.
 */
@Slf4j
public class StopFixture {

    /** A request that takes the model well over a minute to answer in full. */
    public static final String LONG_PROMPT = "Write a detailed, 1500-word essay on the history of remote "
            + "IT support, with a heading for every decade since 1980. Do not use any tools.";

    private static final Duration STREAMING_TIMEOUT = Duration.ofSeconds(60);
    private static final Duration SETTLE = Duration.ofSeconds(8);
    private static final long POLL_INTERVAL_MS = 1000;

    /** What a stopped run left behind, and how long it took to wind down after the stop. */
    public record Stopped(int stopStatus, Duration windDown, RunResult result) {
    }

    /** Sends {@link #LONG_PROMPT}, stops it once it is streaming, and waits for the run to wind down. */
    public static Stopped startAndStop(String dialogId, ChatType chatType) {
        MessageResponse sent = MessageApi.sendMessage(SendMessageRequest.builder()
                .dialogId(dialogId)
                .content(LONG_PROMPT)
                .chatType(chatType)
                .build());
        awaitStreaming(dialogId);
        pause(SETTLE);

        int status = DialogApi.stopGeneration(dialogId, chatType);
        Instant stoppedAt = Instant.now();
        log.info("Stop on dialog {} answered {}", dialogId, status);

        List<Message> messages = new RunWaiter().awaitCompletion(dialogId, chatType,
                Instant.parse(sent.getCreatedAt()), ApprovalPolicy.AUTO_REJECT);
        return new Stopped(status, Duration.between(stoppedAt, Instant.now()), new RunResult(messages));
    }

    private static void awaitStreaming(String dialogId) {
        Instant deadline = Instant.now().plus(STREAMING_TIMEOUT);
        while (Instant.now().isBefore(deadline)) {
            if (DialogApi.streamState(dialogId) == DialogStreamState.STREAMING) {
                return;
            }
            pause(Duration.ofMillis(POLL_INTERVAL_MS));
        }
        assertThat(DialogApi.streamState(dialogId))
                .as("Dialog %s never started streaming, so there was no reply to stop", dialogId)
                .isEqualTo(DialogStreamState.STREAMING);
    }

    private static void pause(Duration duration) {
        try {
            Thread.sleep(duration.toMillis());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new InfraFailureException("Interrupted while driving a stop", e);
        }
    }
}
