package com.openframe.test.tests.ai;

import com.openframe.test.api.AiSettingsApi;
import com.openframe.test.helpers.ai.ApprovalPolicy;
import com.openframe.test.helpers.ai.AssistantRunner;
import com.openframe.test.helpers.ai.ModelSwitch;
import com.openframe.test.helpers.ai.ModelSwitch.Choice;
import com.openframe.test.helpers.ai.RunId;
import com.openframe.test.helpers.ai.RunResult;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Switching Mingo's model in the middle of a chat. The model is part of the tenant-wide admin AI config and
 * is resolved on every run, so the next message of the same chat answers on the new model, with a history
 * the previous model wrote. {@link ModelSwitch#target} picks which model.
 *
 * <p>{@link Isolated}: the setting is tenant-wide, and the pipeline's {@code mingo} phase runs four classes
 * at once, so no other case may be running while it is switched. The original model is restored after the
 * class, and a failed restore fails the class loudly.
 */
@Isolated("switches the tenant-wide Mingo model")
@Tag("ai")
@Tag("mingo")
@Tag("model")
@DisplayName("Mingo — model switch")
public class MingoModelSwitchTest extends MingoBaseTest {

    private static Choice original;
    private static boolean switched;

    @Test
    @DisplayName("Mingo keeps the conversation when its model is switched mid-chat")
    public void testSwitchMidChat() {
        original = ModelSwitch.current(AiSettingsApi.getAdminAiConfig());
        Choice target = ModelSwitch.target(original);
        String code = "E2E-" + RunId.next();

        RunResult before = prompt("Please remember this reference code for later: " + code + ". Reply with just OK.",
                ApprovalPolicy.AUTO_REJECT);
        assertThat(before.answeringModel())
                .as("Before the switch Mingo answers on the configured model %s.\n%s", original.model(), before)
                .isEqualTo(original.model());

        switched = true;
        ModelSwitch.apply(AiSettingsApi::updateAdminAiConfig, target);

        RunResult after = new AssistantRunner(dialog.getDialogId())
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

    @AfterAll
    static void restoreModel() {
        if (switched) {
            ModelSwitch.apply(AiSettingsApi::updateAdminAiConfig, original);
        }
    }
}
