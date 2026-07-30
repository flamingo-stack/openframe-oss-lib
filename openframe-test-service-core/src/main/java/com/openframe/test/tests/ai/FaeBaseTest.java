package com.openframe.test.tests.ai;

import com.openframe.test.data.dto.ai.ChatType;
import com.openframe.test.helpers.ai.AgentSession;
import com.openframe.test.helpers.ai.ApprovalPolicy;
import com.openframe.test.helpers.ai.AssistantRunner;
import com.openframe.test.helpers.ai.DialogFixture;
import com.openframe.test.helpers.ai.InfraFailureException;
import com.openframe.test.helpers.ai.ProviderErrorClassifier;
import com.openframe.test.helpers.ai.ProviderUnavailableException;
import com.openframe.test.helpers.ai.RunResult;
import com.openframe.test.helpers.ai.RunWaiter;
import com.openframe.test.helpers.ai.SshMachineVerifier;
import com.openframe.test.tests.BaseTest;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;

import java.util.concurrent.ThreadLocalRandom;

/**
 * Shared base for the Fae (client AI assistant) E2E cases — the counterpart to {@link MingoBaseTest} for
 * the surface an end user drives from the openframe-chat desktop client.
 *
 * <p>Two things differ from the admin base, and both come from the actor:
 * <ul>
 *   <li><b>The caller is an AGENT, not an ADMIN.</b> Subclasses open an {@code AgentSession} (which
 *       installs a bearer token minted from the machine's own client credentials) and every call in
 *       {@link #prompt} is then made as that agent.</li>
 *   <li><b>The machine is not named in the prompt.</b> The client tools take no machine argument —
 *       {@code runCommand} and {@code executeQuery} read the target from the dialog's memory context,
 *       which the backend fills from the token's {@code machine_id} claim. So where a Mingo prompt says
 *       "…on {host}", a Fae prompt must not: there is exactly one machine it can act on, and naming one
 *       only invites the model to discuss machines it has no tool to reach.</li>
 * </ul>
 *
 * <p>Everything else is the admin harness unchanged: {@link AssistantRunner} already takes a
 * {@link ChatType}, so {@link ChatType#CLIENT_CHAT} is a constructor argument rather than new code, and
 * the dialog/approval/wait mechanics are shared. Provider outages are retried here for the same reasons
 * documented on {@link MingoBaseTest#prompt(String, ApprovalPolicy)} — each attempt needs a fresh dialog.
 */
@Slf4j
public abstract class FaeBaseTest extends BaseTest {

    /** Attempts per prompt when the provider is unavailable, the first attempt included. */
    private static final int MAX_PROVIDER_ATTEMPTS = 3;
    /** First backoff before a retry; doubles per attempt. */
    private static final long PROVIDER_BACKOFF_BASE_MS = 5_000;
    /** Random extra on each backoff, so cases that fail together do not retry in lockstep. */
    private static final long PROVIDER_BACKOFF_JITTER_MS = 2_000;

    /** The dialog opened by the most recent {@link #prompt} call; cleaned up after each test. */
    protected DialogFixture dialog;

    /**
     * The AGENT identity every call in the test body runs as, opened per test. Exposed so cases can
     * assert against the machine the token is actually bound to ({@link AgentSession#getMachineId()}).
     */
    protected AgentSession agent;

    /**
     * Becomes the machine's agent for the test body. Uses the same {@code MachineConfig} target the
     * subclass verifies over SSH, because the credentials are read off that machine — the identity
     * cannot drift from the box under test.
     *
     * <p>Runs after any {@code @BeforeAll} preconditions, so those still execute as ADMIN.
     */
    @BeforeEach
    void openAgentSession() {
        agent = AgentSession.open(new SshMachineVerifier());
    }

    /**
     * Ends the AGENT session early, so the rest of the test body runs as ADMIN again.
     * <p>
     * The capability-boundary and injection cases need this: their pass condition is "no ticket / script /
     * article was created", and reading those back is an ADMIN-only view that the agent's own token
     * cannot see. Call it after the prompt and before the verification. Idempotent — the teardown copes
     * with an already-closed session.
     */
    protected void endAgentSession() {
        if (agent != null) {
            agent.close();
            agent = null;
        }
    }

    /**
     * Releases the AGENT identity, then archives the dialog.
     * <p>
     * Order matters and is why this is one method rather than two {@code @AfterEach}s (JUnit does not
     * order those within a class): the dialog is archived as ADMIN, which is the actor the rest of the
     * suite — and the Mingo teardown path — already exercises.
     */
    @AfterEach
    void releaseAgentAndCleanup() {
        if (agent != null) {
            agent.close();
            agent = null;
        }
        if (dialog != null) {
            dialog.cleanup();
            dialog = null;
        }
    }

    /** Opens a fresh CLIENT dialog and sends Fae a prompt, auto-approving any command it needs to run. */
    protected RunResult prompt(String text) {
        return prompt(text, ApprovalPolicy.AUTO_APPROVE);
    }

    /**
     * Opens a fresh CLIENT dialog and sends Fae a prompt under the given approval policy, retrying the
     * whole attempt (new dialog included) while the model provider is unavailable.
     * <p>
     * Must be called with an {@code AgentSession} open: both the dialog creation and the message are
     * AGENT-authenticated, and the machine binding comes from that token.
     */
    protected RunResult prompt(String text, ApprovalPolicy policy) {
        RunResult result = null;
        for (int attempt = 1; attempt <= MAX_PROVIDER_ATTEMPTS; attempt++) {
            dialog = DialogFixture.openClient();
            result = new AssistantRunner(dialog.getDialogId(), ChatType.CLIENT_CHAT, new RunWaiter())
                    .ask(text, policy);

            if (!ProviderErrorClassifier.isRetryable(result)) {
                return result;
            }
            log.warn("Attempt {}/{} hit a provider outage (upstream request_id {}); the run produced no usable result",
                    attempt, MAX_PROVIDER_ATTEMPTS, ProviderErrorClassifier.requestId(result));

            if (attempt < MAX_PROVIDER_ATTEMPTS) {
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

}
