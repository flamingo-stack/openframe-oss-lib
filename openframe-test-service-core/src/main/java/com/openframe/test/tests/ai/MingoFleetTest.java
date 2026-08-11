package com.openframe.test.tests.ai;

import com.openframe.test.config.MachineConfig;
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

import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * AI assistant multi-host E2E — the blast-radius family: the assistant must act on exactly the machines it
 * was told to, no more. Each case drives the assistant against two real boxes ({@code vm114267} = primary,
 * {@code vm116194} = control) and verifies file state on <em>each</em> box over its own independent SSH
 * channel. The scoping assertion (present on target, absent on control) is the whole point.
 *
 * <p>Requires a second machine ({@code CONTROL_HOSTNAME} / {@code CONTROL_SSH_HOST}); the class is skipped
 * when none is configured. Both boxes are subject to the searchMachines online-flap (left unguarded).
 */
@Tag("ai")
@Tag("mingo")
@Tag("fleet")
@DisplayName("Mingo — multi-host")
public class MingoFleetTest extends MingoBaseTest {

    private static final SshMachineVerifier sshA = new SshMachineVerifier();
    private static SshMachineVerifier sshB;

    private static String hostA;
    private static String hostB;

    private final List<String> pathsToClean = new ArrayList<>();

    @BeforeAll
    public static void preconditions() {
        assumeTrue(MachineConfig.hasControlMachine(),
                "Second (control) machine not configured (CONTROL_HOSTNAME / CONTROL_SSH_HOST) — skipping multi-host cases");
        sshB = SshMachineVerifier.control();
        hostA = MachineFixture.requireOnline(MachineConfig.getHostname(), sshA).getHostname();
        hostB = MachineFixture.requireOnline(MachineConfig.getControlHostname(), sshB).getHostname();
        sshA.ensureTempDir();
        sshB.ensureTempDir();
    }

    @Test
    @Tag("blast")
    @DisplayName("Mingo spares the control machine")
    public void testBlastRadius() {
        RunId runId = RunId.next();
        String path = cleanBoth(sshA.tempFilePath(runId.value() + "-blast"));
        String content = "BLAST-" + runId;

        RunResult result = prompt("Create a file " + path + " containing exactly " + content + " on " + hostA
                + " only. Do not touch any other machine.");

        // Present on the target...
        assertThat(sshA.readFile(path).trim())
                .as("File %s should exist on target %s with exact content.\n%s", path, hostA, result)
                .isEqualTo(content);
        // ...and absent on the control. This is the blast-radius guarantee.
        assertThat(sshB.fileExists(path))
                .as("Control machine %s must not have been touched.\n%s", hostB, result)
                .isFalse();
    }

    @Test
    @Tag("multihost")
    @DisplayName("Mingo writes to both machines")
    public void testMultiHostWrite() {
        RunId runId = RunId.next();
        String path = cleanBoth(sshA.tempFilePath(runId.value() + "-multi"));
        String content = "MULTI-" + runId;

        RunResult result = prompt("Create a file " + path + " containing exactly " + content
                + " on both " + hostA + " and " + hostB + ".");

        assertThat(sshA.readFile(path).trim())
                .as("File %s should exist on %s with exact content.\n%s", path, hostA, result)
                .isEqualTo(content);
        assertThat(sshB.readFile(path).trim())
                .as("File %s should exist on %s with exact content.\n%s", path, hostB, result)
                .isEqualTo(content);
    }

    @Test
    @Tag("multihost")
    @DisplayName("Mingo queries both machines")
    public void testOsqueryAcrossHosts() {
        RunResult result = prompt("Run an osquery live query for the operating system version across the machines "
                + hostA + " and " + hostB + ", and report the result for each machine.");

        assertThat(toolInvoked(result, "runLiveQuery"))
                .as("Assistant should use the runLiveQuery (osquery) tool.\n%s", result)
                .isTrue();
        String reply = result.finalText() == null ? "" : result.finalText();
        assertThat(reply).as("Results should cover %s.\n%s", hostA, result).containsIgnoringCase(hostA);
        assertThat(reply).as("Results should cover %s.\n%s", hostB, result).containsIgnoringCase(hostB);
    }

    // ---- helpers ----


    private boolean toolInvoked(RunResult result, String toolFunction) {
        return result.executedTools().stream().anyMatch(d -> toolFunction.equals(d.getToolFunction()));
    }

    /** Registers a path for cleanup on both boxes (same path shape on each) and returns it. */
    private String cleanBoth(String path) {
        pathsToClean.add(path);
        return path;
    }

    @AfterEach
    public void teardown() {
        for (String path : pathsToClean) {
            sshA.deleteQuietly(path);
            if (sshB != null) {
                sshB.deleteQuietly(path);
            }
        }
    }
}
