package com.openframe.test.tests.ai;

import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.helpers.ai.ClientWritePolicy;
import com.openframe.test.helpers.ai.MachineFixture;
import com.openframe.test.helpers.ai.RunId;
import com.openframe.test.helpers.ai.RunResult;
import com.openframe.test.helpers.ai.SshMachineVerifier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Fae (client AI assistant) device E2E — the milestone that proves the client path works end to end:
 * a prompt sent as the machine's <em>own agent</em> over the product API, then verified on the machine
 * itself over an independent SSH channel.
 *
 * <p>What this case establishes, beyond "a file appeared":
 * <ul>
 *   <li>An AGENT token minted from the machine's real client credentials is accepted by the chat API.</li>
 *   <li>A CLIENT dialog opens for that agent and routes to the client assistant.</li>
 *   <li>Targeting works with <b>no machine named anywhere in the prompt</b> — the backend resolved it
 *       from the token's {@code machine_id} claim alone. That is the whole client-targeting contract.</li>
 * </ul>
 *
 * <p>Preconditions (via {@code MachineConfig} env vars): an enrolled, ONLINE target machine that is
 * SSH-reachable <em>and</em> whose agent config is readable over that SSH (the credentials come from the
 * box). Infra problems fail as {@code InfraFailureException}; a model-provider outage aborts as
 * {@code ProviderUnavailableException} (see {@link FaeBaseTest#prompt}).
 */
@Tag("ai")
@Tag("fae")
@DisplayName("Fae — device")
public class FaeDeviceTest extends FaeBaseTest {

    private static final SshMachineVerifier ssh = new SshMachineVerifier();

    /** The enrolled machine as the backend sees it; established once the target is verified. */
    private static Machine target;

    private final List<String> filesToClean = new ArrayList<>();

    /**
     * Preconditions, once for the class, and deliberately as ADMIN — this runs before the per-test
     * {@code AgentSession} opens, so the device lookup still has an ADMIN identity to use.
     */
    @BeforeAll
    public static void preconditions() {
        target = MachineFixture.requireOnlineTarget(ssh);
        ssh.ensureTempDir();
    }

    // ---- U-A. Core allowed actions on own machine ------------------------------------------------

    @Tag("feature")
    @Test
    @Tag("create")
    @DisplayName("Fae creates a file on the user's own machine")
    public void testFileCreate() {
        RunId runId = RunId.next();
        String path = cleanFile(ssh.tempFilePath(runId.value()));
        String content = "HELLO-" + runId;

        // The agent's identity came off this machine, so a mismatch here means the fixture is pointed at
        // the wrong box — check it before blaming the assistant for acting somewhere unexpected.
        // The token's machine_id claim mirrors the device's machineId (the raw uuid), not its GraphQL
        // global id. Verified against the live tenant: claim a7e70f15-… == vm116194's machineId.
        assertThat(agent.getMachineId())
                .as("The AGENT token must be bound to the machine under verification")
                .isEqualTo(target.getMachineId());

        // No hostname, no machine id: the only thing that can target this write is the token claim.
        RunResult result = prompt("Create a file " + path + " containing exactly " + content + ".");

        assertNotBlockedByPolicy(result, path);

        // Primary assertion — channel B (independent SSH). This is the only thing that proves the action.
        assertThat(ssh.readFile(path).trim())
                .as("File %s should exist on the user's own machine with exact content.\n%s", path, result)
                .isEqualTo(content);
        assertNoFalseSuccess(result, path);
    }

    @Tag("feature")
    @Test
    @Tag("read")
    @DisplayName("Fae reads a file and reports its contents")
    public void testFileRead() {
        RunId runId = RunId.next();
        String path = cleanFile(ssh.tempFilePath(runId.value() + "-seed"));
        String secret = "SECRET-" + runId;
        ssh.writeFile(path, secret);

        RunResult result = prompt("Read the file " + path + " and report its exact contents.");

        // Ground truth is our seed; a read case legitimately asserts on the reply — that IS the outcome —
        // but only against a token we control, so a fabricated answer cannot pass.
        assertThat(result.finalText())
                .as("Reply should contain the seeded contents %s.\n%s", secret, result)
                .contains(secret);
    }

    @Tag("feature")
    @Test
    @Tag("delete")
    @DisplayName("Fae deletes a file")
    public void testFileDelete() {
        RunId runId = RunId.next();
        String path = cleanFile(ssh.tempFilePath(runId.value() + "-doomed"));
        ssh.writeFile(path, "DOOMED-" + runId);
        assertThat(ssh.fileExists(path)).as("precondition: seeded file must exist").isTrue();

        RunResult result = prompt("Delete the file " + path + ".");

        assertThat(ssh.fileExists(path))
                .as("File %s should no longer exist on the user's own machine.\n%s", path, result)
                .isFalse();
    }

    @Test
    @Tag("read")
    @DisplayName("Fae reports its own machine's hostname")
    public void testHostnameQuery() {
        String actualHostname = ssh.hostname();

        // "this machine" is unambiguous here in a way it never is for the admin assistant: the client
        // surface has exactly one machine it can reach.
        RunResult result = prompt("What is the hostname of this machine?");

        assertThat(result.finalText())
                .as("Reply should contain the real hostname %s.\n%s", actualHostname, result)
                .containsIgnoringCase(actualHostname);
    }

    @Test
    @Tag("read")
    @DisplayName("Fae reports a service's real state")
    public void testServiceState() {
        boolean running = ssh.serviceRunning("Spooler");

        RunResult result = prompt("Is the Spooler service running on this machine?");

        String reply = result.finalText() == null ? "" : result.finalText().toLowerCase();
        boolean saysRunning = reply.contains("running")
                && !reply.contains("not running") && !reply.contains("isn't running")
                && !reply.contains("is not running") && !reply.contains("stopped");
        assertThat(saysRunning)
                .as("Reply's claimed Spooler state should match the real state (running=%s).\n%s", running, result)
                .isEqualTo(running);
    }

    @Test
    @Tag("read")
    @DisplayName("Fae reports the real OS build")
    public void testOsVersion() {
        String build = ssh.osBuild();

        RunResult result = prompt("What Windows version and build number is this machine running?");

        assertThat(result.finalText())
                .as("Reply should include the real OS build %s.\n%s", build, result)
                .contains(build);
    }

    // ---- U-G. Read-only correctness & no fabrication ---------------------------------------------

    @Test
    @Tag("read")
    @DisplayName("Fae does not invent the contents of a missing file")
    public void testReadMissingDoesNotHallucinate() {
        RunId runId = RunId.next();
        String path = ssh.tempFilePath(runId.value() + "-missing");
        // Deliberately not created, and not registered for cleanup — its absence is the fixture.
        assertThat(ssh.fileExists(path)).as("precondition: file must be absent").isFalse();

        RunResult result = prompt("Read the file " + path + " and report its exact contents.");

        String reply = result.finalText() == null ? "" : result.finalText().toLowerCase();
        boolean reportsAbsent = ABSENCE_MARKERS.stream().anyMatch(reply::contains);
        assertThat(reportsAbsent)
                .as("Reply should report the file is absent, not invent contents.\n%s", result)
                .isTrue();
    }

    @Test
    @Tag("read")
    @DisplayName("Fae reports real free disk space")
    public void testDiskSpace() {
        long freeGb = ssh.freeDiskGb();

        RunResult result = prompt("How much free disk space, in gigabytes, is available on this machine? "
                + "Give me the number of GB free.");

        // Parse figures from the reply; require at least one within the larger of +/-10% or +/-2GB of truth.
        // The tolerance is not slack for the model — it absorbs the GB/GiB and rounding differences between
        // whatever the assistant's tool reports and the Get-PSDrive figure taken over SSH.
        List<Double> numbers = extractNumbers(result.finalText());
        double tolerance = Math.max(freeGb * 0.10, 2.0);
        boolean close = numbers.stream().anyMatch(n -> Math.abs(n - freeGb) <= tolerance);
        assertThat(close)
                .as("Reply should include a free-space figure near %d GB (SSH truth); parsed %s.\n%s",
                        freeGb, numbers, result)
                .isTrue();
    }

    @Test
    @Tag("read")
    @DisplayName("Fae answers an osquery question with the machine's real value")
    public void testOsqueryOsVersion() {
        String build = ssh.osBuild();

        // Named as an osquery question to steer the model onto FleetMdmToolProvider.executeQuery: every
        // other case on this surface goes through the RMM runCommand tool, so without this the client's
        // second tool provider is never exercised at all. The assertion is the same ground truth as
        // U-SYS-03 — what differs, and what is worth covering, is the path taken to reach it.
        RunResult result = prompt("Run an osquery query against this machine and tell me the "
                + "operating system version it reports.");

        assertThat(result.finalText())
                .as("Reply should include the real OS build %s.\n%s", build, result)
                .contains(build);
    }

    // ---- helpers --------------------------------------------------------------------------------

    /**
     * Ways a reply can say "there is no such file". Broad on purpose: the case fails only if the assistant
     * says none of these <em>and</em> therefore presented some content as the file's — so a phrasing this
     * list misses shows up as a false failure, never as a fabrication slipping through.
     */
    private static final List<String> ABSENCE_MARKERS = List.of(
            "not found", "does not exist", "doesn't exist", "no such", "could not find", "couldn't find",
            "cannot find", "unable to", "not exist", "empty", "no file");

    /** Registers a path for teardown and returns it, so a case never leaves scratch files behind. */
    private String cleanFile(String path) {
        filesToClean.add(path);
        return path;
    }

    /** Every number in the reply, so a figure can be compared against ground truth taken over SSH. */
    private static List<Double> extractNumbers(String text) {
        List<Double> out = new ArrayList<>();
        if (text == null) {
            return out;
        }
        Matcher m = Pattern.compile("\\d+(?:\\.\\d+)?").matcher(text.replace(",", ""));
        while (m.find()) {
            try {
                out.add(Double.parseDouble(m.group()));
            } catch (NumberFormatException ignored) {
                // skip
            }
        }
        return out;
    }

    /**
     * Separates "the tenant forbids this" from "the assistant said it did the work and didn't".
     * <p>
     * Both end with no file on disk, but they are opposite findings: the second is the false-success bug
     * this suite exists to catch, while the first means the case cannot demonstrate anything here — the
     * capability under test is switched off. Observed on qa 2026-07-30: <em>"That action was blocked by
     * your organization's security policy — the RMM tool was not permitted to create or write files on
     * this device"</em>, while the same case passed 5/5 on stage. Failing (rather than skipping) is
     * deliberate: U-FILE-01 is a P0, and a client assistant that cannot write a file is either a policy
     * misconfiguration or a regression — both need a human, and neither should be silently green. The
     * write-negative cases read the same signal through {@link ClientWritePolicy} and skip instead, for
     * the reasons set out there.
     */
    private void assertNotBlockedByPolicy(RunResult result, String path) {
        if (ClientWritePolicy.reportsBlock(result) && !ssh.fileExists(path)) {
            throw new AssertionError(String.format(
                    "The tenant's guardrail refused the write rather than the assistant failing to perform "
                            + "it — the reply reports a policy block and %s is absent, which is consistent. "
                            + "U-FILE-01 assumes a tenant where the client assistant may write files. Either "
                            + "that policy is a regression, or this case has to run against a tenant that "
                            + "permits client RMM writes.\n%s", path, result));
        }
    }

    /**
     * Guards the inverse of a hallucinated success: if the assistant reported a tool execution that
     * succeeded, the file must actually be there.
     */
    private void assertNoFalseSuccess(RunResult result, String path) {
        if (result.anyExecutedToolSucceeded()) {
            assertThat(ssh.fileExists(path))
                    .as("Assistant reported a successful tool execution but the file is absent.\n%s", result)
                    .isTrue();
        }
    }

    @AfterEach
    public void teardown() {
        for (String path : filesToClean) {
            ssh.deleteQuietly(path);
        }
        filesToClean.clear();
    }
}
