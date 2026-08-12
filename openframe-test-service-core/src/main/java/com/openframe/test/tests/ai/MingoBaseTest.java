package com.openframe.test.tests.ai;

import com.openframe.test.helpers.ai.ApprovalPolicy;
import com.openframe.test.helpers.ai.AssistantRunner;
import com.openframe.test.helpers.ai.DialogFixture;
import com.openframe.test.helpers.ai.InfraFailureException;
import com.openframe.test.helpers.ai.ProviderErrorClassifier;
import com.openframe.test.helpers.ai.ProviderUnavailableException;
import com.openframe.test.helpers.ai.RunResult;
import com.openframe.test.tests.BaseTest;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;

import java.util.concurrent.ThreadLocalRandom;

/**
 * Shared base for the Mingo (admin AI assistant) E2E cases: opens a fresh dialog per prompt, drives Mingo,
 * and archives the dialog afterwards. Subclasses call {@link #prompt} and add their own domain assertions
 * and artifact cleanup; the dialog itself is torn down here.
 *
 * <p><b>Provider outages are retried here, once, for every case.</b> {@link #prompt} is the single place
 * the whole suite drives the assistant from, so the retry sits here rather than in each test — and here
 * rather than inside {@link AssistantRunner} because a retry needs a <em>fresh dialog</em> and this class
 * is what owns dialog lifecycle. See {@link #prompt(String, ApprovalPolicy)} for why the dialog must be
 * fresh.
 */
@Slf4j
public abstract class MingoBaseTest extends BaseTest {

    /** Attempts per prompt when the provider is unavailable, the first attempt included. */
    private static final int MAX_PROVIDER_ATTEMPTS = 3;
    /** First backoff before a retry; doubles per attempt. */
    private static final long PROVIDER_BACKOFF_BASE_MS = 5_000;
    /** Random extra on each backoff, so cases that fail together do not retry in lockstep. */
    private static final long PROVIDER_BACKOFF_JITTER_MS = 2_000;

    /** The dialog opened by the most recent {@link #prompt} call; cleaned up after each test. */
    protected DialogFixture dialog;

    /** Opens a fresh dialog and sends Mingo a prompt, auto-approving any command it needs to run. */
    protected RunResult prompt(String text) {
        return prompt(text, ApprovalPolicy.AUTO_APPROVE);
    }

    /**
     * Opens a fresh dialog and sends Mingo a prompt, applying the given approval policy. If the run comes
     * back carrying a provider outage (overloaded / rate-limited / 5xx — see
     * {@link ProviderErrorClassifier}) the prompt is retried with exponential backoff, and the case aborts
     * as {@link ProviderUnavailableException} if the provider never recovers.
     *
     * <p><b>Each attempt gets its own dialog</b>, for two reasons. Re-sending on the same dialog appends a
     * duplicate user message, so the retry would run with the previous failure in the model's context —
     * the cases asserting on {@code finalText()} would then be exercising a different scenario than a
     * normal first run. And {@link RunResult#errors()} is conversation-wide with no per-entry timestamp,
     * so the previous attempt's error would still be visible in the next attempt's result and a successful
     * retry would be misread as another failure.
     */
    protected RunResult prompt(String text, ApprovalPolicy policy) {
        RunResult result = null;
        for (int attempt = 1; attempt <= MAX_PROVIDER_ATTEMPTS; attempt++) {
            dialog = DialogFixture.open();
            result = new AssistantRunner(dialog.getDialogId()).ask(text, policy);

            if (!ProviderErrorClassifier.isRetryable(result)) {
                return result;
            }
            log.warn("Attempt {}/{} hit a provider outage (upstream request_id {}); the run produced no usable result",
                    attempt, MAX_PROVIDER_ATTEMPTS, ProviderErrorClassifier.requestId(result));

            if (attempt < MAX_PROVIDER_ATTEMPTS) {
                // Abandon this attempt's dialog now; the next one opens its own, and only the last is
                // left in the field for @AfterEach.
                dialog.cleanup();
                dialog = null;
                backoff(attempt);
            }
        }

        throw new ProviderUnavailableException(String.format(
                "Model provider unavailable on all %d attempts (upstream request_id %s). Conversation of the last attempt:\n%s",
                MAX_PROVIDER_ATTEMPTS, ProviderErrorClassifier.requestId(result), result));
    }

    /** Exponential backoff with jitter, in front of retry number {@code attempt + 1}. */
    private static void backoff(int attempt) {
        long delay = PROVIDER_BACKOFF_BASE_MS * (1L << (attempt - 1))
                + ThreadLocalRandom.current().nextLong(PROVIDER_BACKOFF_JITTER_MS);
        log.info("Backing off {} ms before retrying the prompt", delay);
        try {
            Thread.sleep(delay);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new InfraFailureException("Interrupted while backing off before an assistant retry", e);
        }
    }

    @AfterEach
    void cleanupDialog() {
        if (dialog != null) {
            dialog.cleanup();
            dialog = null;
        }
    }
}
