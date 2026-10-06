package com.openframe.test.tests.ai;

import com.openframe.test.data.dto.ai.ChatType;
import com.openframe.test.helpers.ai.ApprovalPolicy;
import com.openframe.test.helpers.ai.AssistantRunner;
import com.openframe.test.helpers.ai.CompactionWaiter;
import com.openframe.test.helpers.ai.MachineFixture;
import com.openframe.test.helpers.ai.RunId;
import com.openframe.test.helpers.ai.RunResult;
import com.openframe.test.helpers.ai.RunWaiter;
import com.openframe.test.helpers.ai.SshMachineVerifier;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Manual context compaction in a Fae chat, requested by the client itself (the AGENT identity). The same
 * endpoint serves both assistants and resolves the chat type from the dialog, so this covers the CLIENT
 * path: the summary, and Fae continuing from it.
 *
 * <p>Threshold-triggered compaction is deliberately not covered: reaching Fae's threshold takes a
 * conversation of about 40k tokens. The refusal cases live in {@link MingoCompactionTest}: an empty client
 * chat would leave an untitled ticket on the shared tenant for good.
 */
@Tag("ai")
@Tag("fae")
@Tag("compaction")
@DisplayName("Fae — context compaction")
public class FaeCompactionTest extends FaeBaseTest {

    @BeforeAll
    public static void preconditions() {
        MachineFixture.requireOnlineTarget(new SshMachineVerifier());
    }

    @Test
    @DisplayName("Fae remembers what it was told after its chat is compacted")
    public void testKeepsContextAcrossCompaction() {
        String code = "E2E-" + RunId.next();
        prompt("Please remember this reference code for later: " + code + ". Reply with just OK.",
                ApprovalPolicy.AUTO_REJECT);
        String dialogId = dialog.getDialogId();

        assertThat(CompactionWaiter.requestWhenIdle(dialogId))
                .as("Compaction of a chat with history must be accepted from the client")
                .isEqualTo(202);
        String summary = CompactionWaiter.awaitSummary(dialogId, ChatType.CLIENT_CHAT);
        assertThat(summary).as("The compaction summary must keep the code %s", code).contains(code);

        RunResult after = new AssistantRunner(dialogId, ChatType.CLIENT_CHAT, new RunWaiter())
                .ask("What reference code did I ask you to remember? Reply with just the code.",
                        ApprovalPolicy.AUTO_REJECT);
        assertThat(after.finalText())
                .as("After compaction Fae must still know the code %s.\n%s", code, after)
                .contains(code);
    }
}
