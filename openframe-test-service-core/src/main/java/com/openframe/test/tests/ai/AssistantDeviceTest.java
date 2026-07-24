package com.openframe.test.tests.ai;

import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.helpers.ai.AssistantRunner;
import com.openframe.test.helpers.ai.DialogFixture;
import com.openframe.test.helpers.ai.MachineFixture;
import com.openframe.test.helpers.ai.RunId;
import com.openframe.test.helpers.ai.RunResult;
import com.openframe.test.helpers.ai.SshMachineVerifier;
import com.openframe.test.tests.BaseTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * AI assistant device E2E — the milestone case that proves the whole chain: send a prompt over the
 * product API, let the real system run, then <em>go look at the machine</em> over an independent SSH
 * channel. Assertions are on machine state, never on the generated command or the assistant's prose.
 *
 * <p>Preconditions (configured via {@code MachineConfig} env vars): an enrolled, ONLINE target machine
 * that is also SSH-reachable. Infra problems (offline/unreachable/timeout) abort as
 * {@code InfraFailureException} rather than failing the build.
 */
@Tag("ai")
@Tag("saas")
@DisplayName("AI Assistant — device")
public class AssistantDeviceTest extends BaseTest {

    private final SshMachineVerifier ssh = new SshMachineVerifier();

    private DialogFixture dialog;
    private String createdPath;

    @Test
    @Tag("create")
    @DisplayName("FILE-01: assistant creates a file with exact content on a real machine")
    public void fileCreate_FILE_01() {
        RunId runId = RunId.next();
        // OS-appropriate path: C:\Temp\{id}.txt on the Windows fleet, /tmp/{id}.txt on Linux.
        String path = ssh.tempFilePath(runId.value());
        String content = "HELLO-" + runId;
        this.createdPath = path;

        // Preconditions: target ONLINE and SSH-reachable (else abort as infra, not a behavioral failure).
        Machine target = MachineFixture.requireOnlineTarget(ssh);

        // Target the machine the technician way: ADMIN dialog linked to a ticket bound to the device.
        dialog = DialogFixture.forMachine(target, runId);

        // Drive the assistant; approve the command if it asks.
        AssistantRunner runner = new AssistantRunner(dialog.getDialogId());
        RunResult result = runner.ask(
                "Create a file " + path + " containing exactly " + content + " on this machine.");

        // Primary assertion — channel B (independent SSH). This is the only thing that proves the action.
        String actual = ssh.readFile(path).trim();
        assertThat(actual)
                .as("File %s should exist on the box with exact content.\n%s", path, result)
                .isEqualTo(content);

        // Secondary (no false success): if the assistant reported a successful tool run, the file must be
        // real. The primary assertion already guarantees that; this makes the intent explicit.
        if (result.anyExecutedToolSucceeded()) {
            assertThat(ssh.fileExists(path))
                    .as("Assistant reported a successful tool execution but the file is absent.\n%s", result)
                    .isTrue();
        }
    }

    @AfterEach
    public void teardown() {
        if (createdPath != null) {
            ssh.deleteQuietly(createdPath);
        }
        if (dialog != null) {
            dialog.cleanup();
        }
    }
}
