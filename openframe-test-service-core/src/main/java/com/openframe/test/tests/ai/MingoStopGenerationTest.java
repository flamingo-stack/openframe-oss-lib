package com.openframe.test.tests.ai;

import com.openframe.test.api.DialogApi;
import com.openframe.test.data.dto.ai.ChatType;
import com.openframe.test.helpers.ai.ApprovalPolicy;
import com.openframe.test.helpers.ai.AssistantRunner;
import com.openframe.test.helpers.ai.DialogFixture;
import com.openframe.test.helpers.ai.RunResult;
import com.openframe.test.helpers.ai.StopFixture;
import com.openframe.test.helpers.ai.StopFixture.Stopped;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Stopping a Mingo reply ({@code POST /dialogs/{id}/stop}, the chat's Stop button). A stop raises a flag the
 * run checks as tokens arrive; the run then saves what it had written, clears the flag and frees the
 * dialog. A flag left behind would silently swallow the chat's next message, which is why every case
 * sends one after stopping.
 */
@Tag("ai")
@Tag("mingo")
@Tag("stop")
@DisplayName("Mingo — stop generation")
public class MingoStopGenerationTest extends MingoBaseTest {

    /** A full answer to {@link StopFixture#LONG_PROMPT} takes well over this. */
    private static final Duration WIND_DOWN = Duration.ofSeconds(45);

    @Test
    @DisplayName("Stopping a Mingo reply ends it early, keeps the partial answer, and the chat carries on")
    public void testStopMidReply() {
        dialog = DialogFixture.open();
        String dialogId = dialog.getDialogId();

        Stopped stopped = StopFixture.startAndStop(dialogId, ChatType.ADMIN_AI_CHAT);

        assertThat(stopped.stopStatus()).as("Stopping a running reply must be accepted").isEqualTo(200);
        assertThat(stopped.windDown())
                .as("The reply must end promptly after the stop.\n%s", stopped.result())
                .isLessThanOrEqualTo(WIND_DOWN);
        assertThat(stopped.result().finalText())
                .as("The partial answer written before the stop must be kept.\n%s", stopped.result())
                .isNotBlank();

        RunResult next = new AssistantRunner(dialogId).ask("Reply with just the word READY.", ApprovalPolicy.AUTO_REJECT);
        assertThat(next.finalText())
                .as("The chat must answer normally after a stop.\n%s", next)
                .containsIgnoringCase("READY");
    }

    @Test
    @DisplayName("Stopping a Mingo chat with no reply running is refused")
    public void testStopWhenIdle() {
        dialog = DialogFixture.open();

        // The endpoint's API docs call it idempotent with 200; the service answers 409 ILLEGAL_STATE
        // ("No active session to stop found"). This pins the behaviour the service has.
        assertThat(DialogApi.stopGeneration(dialog.getDialogId(), ChatType.ADMIN_AI_CHAT))
                .as("A stop with nothing running must be refused")
                .isEqualTo(409);
    }
}
