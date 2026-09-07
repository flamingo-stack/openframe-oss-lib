package com.openframe.test.tests.ai;

import com.openframe.test.api.ScriptApi;
import com.openframe.test.config.MachineOs;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.script.CreateScriptInput;
import com.openframe.test.data.dto.script.Script;
import com.openframe.test.helpers.ai.*;
import org.junit.jupiter.api.*;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * AI assistant device E2E — cases that prove the whole chain: send a prompt over the product API, let the
 * real system run, then <em>go look at the machine</em> over an independent SSH channel. Assertions are on
 * machine state (or, for read/query cases, on ground truth taken from SSH), never on the generated command.
 *
 * <p>Preconditions (configured via {@code MachineConfig} env vars): an enrolled, ONLINE target machine that
 * is also SSH-reachable. Infra problems (offline/unreachable/timeout) fail the build as
 * {@code InfraFailureException}; only a model-provider outage aborts, as {@code ProviderUnavailableException}
 * (see {@code MingoBaseTest#prompt}). The machine is targeted by hostname in the prompt — the assistant
 * resolves it via its own {@code searchMachines} tool — so no ticket binding is needed.
 */
@Tag("ai")
@Tag("mingo")
@DisplayName("Mingo — device")
public class MingoDeviceTest extends MingoBaseTest {

    private static final SshMachineVerifier ssh = new SshMachineVerifier();

    /**
     * Hostname the assistant resolves via searchMachines; established once the target is verified.
     */
    private static String host;

    private final List<String> filesToClean = new ArrayList<>();
    private final List<String> dirsToClean = new ArrayList<>();
    private final List<String> scriptsToClean = new ArrayList<>();

    /**
     * Preconditions, once for the class: the target must be enrolled+ONLINE and SSH-reachable (else the
     * run aborts as infra, not a behavioral failure), and its scratch dir must exist so the assistant's
     * write has a valid parent. Resolves the hostname used to target the machine deterministically —
     * "this machine" is ambiguous and the model sometimes stops to ask which one.
     */
    @BeforeAll
    public static void preconditions() {
        Machine target = MachineFixture.requireOnlineTarget(ssh);
        ssh.ensureTempDir();
        host = target.getHostname();
    }

    // ---- A. File operations ---------------------------------------------------------------------

    @Tag("feature")
    @Test
    @Tag("create")
    @DisplayName("Mingo creates a file")
    public void testFileCreate() {
        RunId runId = RunId.next();
        String path = cleanFile(ssh.tempFilePath(runId.value()));
        String content = "HELLO-" + runId;

        RunResult result = prompt("Create a file " + path + " containing exactly " + content + " on " + host + ".");

        // Primary assertion — channel B (independent SSH). This is the only thing that proves the action.
        assertThat(ssh.readFile(path).trim())
                .as("File %s should exist on the box with exact content.\n%s", path, result)
                .isEqualTo(content);
        assertNoFalseSuccess(result, path);
    }

    @Tag("feature")
    @Test
    @Tag("read")
    @DisplayName("Mingo reads a file")
    public void testFileRead() {
        RunId runId = RunId.next();
        String path = cleanFile(ssh.tempFilePath(runId.value() + "-seed"));
        String secret = "SECRET-" + runId;
        ssh.writeFile(path, secret);

        RunResult result = prompt("Read the file " + path + " on " + host + " and report its exact contents.");

        // Ground truth is our seed; the assistant's reply must contain it (a read case legitimately asserts
        // on the reply — that is the outcome — but only against a token we control).
        assertThat(result.finalText())
                .as("Reply should contain the seeded contents %s.\n%s", secret, result)
                .contains(secret);
    }

    @Test
    @Tag("delete")
    @DisplayName("Mingo deletes a file")
    public void testFileDelete() {
        RunId runId = RunId.next();
        String path = cleanFile(ssh.tempFilePath(runId.value() + "-doomed"));
        ssh.writeFile(path, "DOOMED-" + runId);
        assertThat(ssh.fileExists(path)).as("precondition: seeded file must exist").isTrue();

        RunResult result = prompt("Delete the file " + path + " on " + host + ".");

        assertThat(ssh.fileExists(path))
                .as("File %s should no longer exist on the box.\n%s", path, result)
                .isFalse();
    }

    @Test
    @Tag("append")
    @DisplayName("Mingo appends without clobbering")
    public void testFileAppend() {
        RunId runId = RunId.next();
        String path = cleanFile(ssh.tempFilePath(runId.value() + "-seed"));
        String original = "ORIGINAL-" + runId;
        String appended = "APPENDED-" + runId;
        ssh.writeFile(path, original);

        RunResult result = prompt("Append a new line containing exactly " + appended
                + " to the file " + path + " on " + host + ", keeping the existing contents.");

        // Both lines must survive — guards against a clobbering `>`/Set-Content instead of an append.
        String actual = ssh.readFile(path);
        assertThat(actual).as("Original line must survive the append.\n%s", result).contains(original);
        assertThat(actual).as("Appended line must be present.\n%s", result).contains(appended);
    }

    @Test
    @Tag("create")
    @DisplayName("Mingo creates a nested directory")
    public void testDirCreate() {
        RunId runId = RunId.next();
        String sep = ssh.os() == MachineOs.WINDOWS ? "\\" : "/";
        String root = cleanDir(ssh.tempDir() + sep + runId.value());
        String nested = root + sep + "nested" + sep + "deep";

        RunResult result = prompt("Create the directory " + nested + " on " + host + ".");

        assertThat(ssh.dirExists(nested))
                .as("Directory %s should exist on the box.\n%s", nested, result)
                .isTrue();
    }

    @Test
    @Tag("create")
    @DisplayName("Mingo doesn't fake success on a protected path")
    public void testFileCreateElevated() {
        RunId runId = RunId.next();
        String sep = ssh.os() == MachineOs.WINDOWS ? "\\" : "/";
        String protectedDir = ssh.os() == MachineOs.WINDOWS ? "C:\\Program Files" : "/opt";
        String path = cleanFile(protectedDir + sep + runId.value() + ".txt");
        String content = "ELEVATED-" + runId;

        RunResult result = prompt("Create a file " + path + " containing exactly " + content + " on " + host + ".");

        // The canary: if the file is absent, the assistant must have reported a failure — never claimed
        // success. If the file exists, it genuinely had the rights and that is fine too.
        if (!ssh.fileExists(path)) {
            String reply = result.finalText() == null ? "" : result.finalText().toLowerCase();
            boolean acknowledgesFailure = reply.contains("fail") || reply.contains("denied")
                    || reply.contains("permission") || reply.contains("unable") || reply.contains("could not")
                    || reply.contains("couldn't") || reply.contains("cannot") || reply.contains("elevat")
                    || reply.contains("error") || reply.contains("not created") || reply.contains("access");
            assertThat(acknowledgesFailure)
                    .as("File is absent, so the assistant must report a failure — not claim success.\n%s", result)
                    .isTrue();
        }
    }

    // ---- B. System-state queries ----------------------------------------------------------------

    @Test
    @Tag("read")
    @DisplayName("Mingo reports the hostname")
    public void testHostnameQuery() {
        String actualHostname = ssh.hostname();

        RunResult result = prompt("What is the hostname of the machine " + host + "?");

        assertThat(result.finalText())
                .as("Reply should contain the real hostname %s.\n%s", actualHostname, result)
                .containsIgnoringCase(actualHostname);
    }

    @Test
    @Tag("read")
    @DisplayName("Mingo reports a service's state")
    public void testServiceState() {
        boolean running = ssh.serviceRunning("Spooler");

        RunResult result = prompt("Is the Spooler service running on " + host + "?");

        // Ground truth from SSH; the reply's claimed state must match it. Kept tolerant to phrasing.
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
    @DisplayName("Mingo reports the OS build")
    public void testOsVersion() {
        String build = ssh.osBuild();

        RunResult result = prompt("What Windows version and build number is the machine " + host + " running?");

        assertThat(result.finalText())
                .as("Reply should include the real OS build %s.\n%s", build, result)
                .contains(build);
    }

    @Test
    @Tag("read")
    @DisplayName("Mingo reports free disk space")
    public void testDiskSpace() {
        long freeGb = ssh.freeDiskGb();

        RunResult result = prompt("How much free disk space, in gigabytes, is available on the C: drive of "
                + host + "? Give me the number of GB free.");

        // Parse figures from the reply; require at least one within the larger of +/-10% or +/-2GB of truth.
        List<Double> numbers = extractNumbers(result.finalText());
        double tolerance = Math.max(freeGb * 0.10, 2.0);
        boolean close = numbers.stream().anyMatch(n -> Math.abs(n - freeGb) <= tolerance);
        assertThat(close)
                .as("Reply should include a free-space figure near %d GB (SSH truth); parsed %s.\n%s",
                        freeGb, numbers, result)
                .isTrue();
    }

    // ---- L. Multi-step and dependent operations -------------------------------------------------

    @Test
    @Tag("multi")
    @DisplayName("Mingo creates a file in a new directory")
    public void testMultiCreateInNewDir() {
        RunId runId = RunId.next();
        String sep = ssh.os() == MachineOs.WINDOWS ? "\\" : "/";
        String dir = cleanDir(ssh.tempDir() + sep + runId.value());
        String path = dir + sep + "report.txt";
        String content = "R-" + runId;

        RunResult result = prompt("Create a file " + path + " containing exactly " + content + " on " + host
                + ", creating the directory first if it does not exist.");

        assertThat(ssh.dirExists(dir)).as("Directory %s should have been created.\n%s", dir, result).isTrue();
        assertThat(ssh.readFile(path).trim())
                .as("File %s should exist with exact content.\n%s", path, result)
                .isEqualTo(content);
    }

    @Test
    @Tag("multi")
    @DisplayName("Mingo creates then reads back")
    public void testMultiCreateThenRead() {
        RunId runId = RunId.next();
        String path = cleanFile(ssh.tempFilePath(runId.value() + "-rt"));
        String content = "V-" + runId;

        RunResult result = prompt("Create a file " + path + " containing exactly " + content + " on " + host
                + ", then read it back and tell me exactly what it says.");

        assertThat(ssh.readFile(path).trim())
                .as("File %s should exist with exact content.\n%s", path, result)
                .isEqualTo(content);
        assertThat(result.finalText())
                .as("Reply should echo the content it read back.\n%s", result)
                .contains(content);
    }

    @Tag("feature")
    @Test
    @Tag("script")
    @DisplayName("Mingo runs a saved script")
    public void testScriptRun() {
        RunId runId = RunId.next();
        String path = cleanFile(ssh.tempFilePath(runId.value() + "-scr"));
        String token = "S-" + runId;
        String name = "E2E-" + runId + "-run";

        // Seed a script (setup) whose body writes the token to a known path on the box.
        //
        // ADMIN rather than USER: a USER-privilege execution is dispatched as run_as_user, which the agent
        // refuses with "run_as_user requested but no active interactive session" unless somebody is logged
        // into the box — so as USER this case failed on the target having no console/RDP session rather
        // than on anything Mingo did. Nothing here is about the run-as-user path (the case is that Mingo
        // can run a *saved* script), so it should not depend on that session existing. PrivilegeLevel is
        // {USER, ADMIN}; there is no SYSTEM level to ask for.
        Script script = ScriptApi.createScript(CreateScriptInput.builder()
                .name(name)
                .description("e2e run target")
                .shell("POWERSHELL")
                .privilegeLevel("ADMIN")
                .scriptBody("Set-Content -LiteralPath '" + path + "' -Value '" + token + "' -NoNewline -Encoding utf8")
                .supportedPlatforms(List.of("WINDOWS"))
                .defaultTimeoutSeconds(90)
                .build());
        scriptsToClean.add(script.getId());

        RunResult result = prompt("Run the script named \"" + name + "\" on " + host + ".");

        assertThat(ssh.readFile(path).trim())
                .as("Running the script should have written the token to %s.\n%s", path, result)
                .isEqualTo(token);
    }

    @Test
    @Tag("multi")
    @DisplayName("Mingo creates and runs a script")
    public void testMultiScriptCreateAndRun() {
        RunId runId = RunId.next();
        String path = cleanFile(ssh.tempFilePath(runId.value() + "-m3"));
        String token = "S-" + runId;

        RunResult result = prompt("Create a script that writes exactly " + token + " to the file " + path
                + ", then run that script on " + host + ".");

        assertThat(ssh.readFile(path).trim())
                .as("The created-and-run script should have written the token to %s.\n%s", path, result)
                .isEqualTo(token);
    }

    // ---- helpers --------------------------------------------------------------------------------

    /**
     * Registers a file for teardown and returns the path, so a case reads as one line.
     */
    private String cleanFile(String path) {
        filesToClean.add(path);
        return path;
    }

    /** Extracts numeric figures (integers/decimals, commas stripped) from assistant prose. */
    private static List<Double> extractNumbers(String text) {
        List<Double> out = new ArrayList<>();
        if (text == null) {
            return out;
        }
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\d+(?:\\.\\d+)?")
                .matcher(text.replace(",", ""));
        while (m.find()) {
            try {
                out.add(Double.parseDouble(m.group()));
            } catch (NumberFormatException ignored) {
                // skip
            }
        }
        return out;
    }

    private String cleanDir(String path) {
        dirsToClean.add(path);
        return path;
    }

    /**
     * No false success: if the assistant reported a successful tool run, the file must actually be on the
     * box. The primary assertion already guarantees the happy path; this makes a hallucinated "Done"
     * explicit. Only applied to cases whose success implies the file exists.
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
        for (String dir : dirsToClean) {
            ssh.deleteDirQuietly(dir);
        }
        for (String scriptId : scriptsToClean) {
            try {
                ScriptApi.deleteScript(scriptId);
            } catch (RuntimeException ignored) {
                // best-effort
            }
        }
    }
}
