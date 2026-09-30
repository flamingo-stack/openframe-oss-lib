package com.openframe.test.tests.ai;

import com.openframe.test.data.dto.ai.ChatType;
import com.openframe.test.helpers.ai.ApprovalPolicy;
import com.openframe.test.helpers.ai.AssistantRunner;
import com.openframe.test.helpers.ai.DialogFixture;
import com.openframe.test.helpers.ai.MachineFixture;
import com.openframe.test.helpers.ai.RunResult;
import com.openframe.test.helpers.ai.RunWaiter;
import com.openframe.test.helpers.ai.SshMachineVerifier;
import com.openframe.test.helpers.ai.StopFixture;
import com.openframe.test.helpers.ai.StopFixture.Stopped;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Stopping a Fae reply from the client itself (the AGENT identity), the same endpoint and flag as Mingo's.
 * The idle-stop refusal lives in {@link MingoStopGenerationTest}; here the point is that the client may
 * stop its own reply and its chat keeps working.
 */
@Tag("ai")
@Tag("fae")
@Tag("stop")
@DisplayName("Fae — stop generation")
public class FaeStopGenerationTest extends FaeBaseTest {

    /** A full answer to {@link StopFixture#LONG_PROMPT} takes well over this. */
    private static final Duration WIND_DOWN = Duration.ofSeconds(45);

    @BeforeAll
    public static void preconditions() {
        MachineFixture.requireOnlineTarget(new SshMachineVerifier());
    }

    @Test
    @DisplayName("Stopping a Fae reply ends it early, keeps the partial answer, and the chat carries on")
    public void testStopMidReply() {
        dialog = DialogFixture.openClient();
        String dialogId = dialog.getDialogId();

        Stopped stopped = StopFixture.startAndStop(dialogId, ChatType.CLIENT_CHAT);

        assertThat(stopped.stopStatus()).as("The client must be able to stop its own reply").isEqualTo(200);
        assertThat(stopped.windDown())
                .as("The reply must end promptly after the stop.\n%s", stopped.result())
                .isLessThanOrEqualTo(WIND_DOWN);
        assertThat(stopped.result().finalText())
                .as("The partial answer written before the stop must be kept.\n%s", stopped.result())
                .isNotBlank();

        RunResult next = new AssistantRunner(dialogId, ChatType.CLIENT_CHAT, new RunWaiter())
                .ask("Reply with just the word READY.", ApprovalPolicy.AUTO_REJECT);
        assertThat(next.finalText())
                .as("The chat must answer normally after a stop.\n%s", next)
                .containsIgnoringCase("READY");
    }
}
