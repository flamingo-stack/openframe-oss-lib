package com.openframe.test.tests.ai;

import com.openframe.test.helpers.ai.ApprovalPolicy;
import com.openframe.test.helpers.ai.AssistantRunner;
import com.openframe.test.helpers.ai.DialogFixture;
import com.openframe.test.helpers.ai.RunResult;
import com.openframe.test.tests.BaseTest;
import org.junit.jupiter.api.AfterEach;

/**
 * Shared base for the Mingo (admin AI assistant) E2E cases: opens a fresh dialog per prompt, drives Mingo,
 * and archives the dialog afterwards. Subclasses call {@link #prompt} and add their own domain assertions
 * and artifact cleanup; the dialog itself is torn down here.
 */
public abstract class MingoBaseTest extends BaseTest {

    /** The dialog opened by the most recent {@link #drive} call; cleaned up after each test. */
    protected DialogFixture dialog;

    /** Opens a fresh dialog and sends Mingo a prompt, auto-approving any command it needs to run. */
    protected RunResult prompt(String text) {
        return prompt(text, ApprovalPolicy.AUTO_APPROVE);
    }

    /** Opens a fresh dialog and sends Mingo a prompt, applying the given approval policy. */
    protected RunResult prompt(String text, ApprovalPolicy policy) {
        dialog = DialogFixture.open();
        return new AssistantRunner(dialog.getDialogId()).ask(text, policy);
    }

    @AfterEach
    void cleanupDialog() {
        if (dialog != null) {
            dialog.cleanup();
            dialog = null;
        }
    }
}
