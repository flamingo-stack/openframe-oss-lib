package com.openframe.test.tests.ai;

import com.openframe.test.api.AiSettingsApi;
import com.openframe.test.data.dto.ai.ChatType;
import com.openframe.test.helpers.ai.AgentSession;
import com.openframe.test.helpers.ai.ApprovalPolicy;
import com.openframe.test.helpers.ai.AssistantRunner;
import com.openframe.test.helpers.ai.MachineFixture;
import com.openframe.test.helpers.ai.ModelSwitch;
import com.openframe.test.helpers.ai.ModelSwitch.Choice;
import com.openframe.test.helpers.ai.RunId;
import com.openframe.test.helpers.ai.RunResult;
import com.openframe.test.helpers.ai.RunWaiter;
import com.openframe.test.helpers.ai.SshMachineVerifier;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Switching Fae's model in the middle of a client chat. A technician (ADMIN) changes the tenant-wide client
 * AI config between two of the client's (AGENT) messages; the second answers on the new model with the
 * history the previous model wrote. {@link ModelSwitch#target} picks which model.
 *
 * <p>The client resolves its organization's effective config, so an organization override would shadow the
 * tenant-wide switch; the case checks what the client itself sees before blaming the assistant.
 * {@link Isolated} for the same reason as {@link MingoModelSwitchTest}: the {@code fae} phase runs four
 * classes at once on the same tenant.
 */
@Isolated("switches the tenant-wide Fae model")
@Tag("ai")
@Tag("fae")
@Tag("model")
@DisplayName("Fae — model switch")
public class FaeModelSwitchTest extends FaeBaseTest {

    private static Choice original;
    private static boolean switched;

    /** Runs as ADMIN, before the per-test AGENT session opens. */
    @BeforeAll
    public static void preconditions() {
        MachineFixture.requireOnlineTarget(new SshMachineVerifier());
        original = ModelSwitch.current(AiSettingsApi.getClientAiConfig());
    }

    @Test
    @DisplayName("Fae keeps the conversation when its model is switched mid-chat")
    public void testSwitchMidChat() {
        Choice target = ModelSwitch.target(original);
        String code = "E2E-" + RunId.next();

        RunResult before = prompt("Please remember this reference code for later: " + code + ". Reply with just OK.",
                ApprovalPolicy.AUTO_REJECT);
        assertThat(before.answeringModel())
                .as("Before the switch Fae answers on the tenant's client model %s (an organization override "
                        + "would show here).\n%s", original.model(), before)
                .isEqualTo(original.model());
        String dialogId = dialog.getDialogId();

        // ADMIN: the technician switches the client assistant's model.
        endAgentSession();
        switched = true;
        ModelSwitch.apply(AiSettingsApi::updateClientAiConfig, target);

        // AGENT again: the client continues the same chat.
        agent = AgentSession.open(new SshMachineVerifier());
        assertThat(AiSettingsApi.getClientAiConfig().getProviderModel())
                .as("The client must see the switched model; anything else is an organization override")
                .isEqualTo(target.model());
        RunResult after = new AssistantRunner(dialogId, ChatType.CLIENT_CHAT, new RunWaiter())
                .ask("What reference code did I ask you to remember? Reply with just the code.",
                        ApprovalPolicy.AUTO_REJECT);
        assertThat(after.answeringModel())
                .as("After the switch the same chat answers on %s.\n%s", target.model(), after)
                .isEqualTo(target.model());
        assertThat(after.errors())
                .as("%s must answer after the switch, not fail.\n%s", target.model(), after)
                .isEmpty();
        assertThat(after.finalText())
                .as("%s must still have the conversation %s held (code %s).\n%s",
                        target.model(), original.model(), code, after)
                .contains(code);
    }

    /** Runs after the per-test teardown has released the AGENT session, so as ADMIN. */
    @AfterAll
    static void restoreModel() {
        if (switched) {
            ModelSwitch.apply(AiSettingsApi::updateClientAiConfig, original);
        }
    }
}
