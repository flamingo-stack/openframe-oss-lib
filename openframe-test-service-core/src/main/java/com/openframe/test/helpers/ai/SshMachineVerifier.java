package com.openframe.test.helpers.ai;

import com.openframe.test.config.MachineConfig;
import com.openframe.test.config.MachineOs;
import net.schmizz.sshj.SSHClient;
import net.schmizz.sshj.common.IOUtils;
import net.schmizz.sshj.connection.channel.direct.Session;
import net.schmizz.sshj.transport.verification.PromiscuousVerifier;
import lombok.extern.slf4j.Slf4j;
import lombok.Getter;
import lombok.AllArgsConstructor;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.concurrent.TimeUnit;

/**
 * Channel B for device cases: an independent SSH connection to the target box used to verify what the
 * assistant actually did. Any transport failure here is an {@link InfraFailureException}, never an
 * assertion failure — if we cannot reach the box we do not know whether the assistant did its job.
 *
 * <p>File helpers adapt to the target OS ({@link MachineOs}). The provisioned fleet is Windows: helpers
 * build raw PowerShell, and {@link #exec(String)} runs it as {@code powershell -EncodedCommand <base64>}
 * so it works regardless of the box's default OpenSSH shell (some default to {@code cmd.exe}, others to
 * PowerShell). Linux uses a POSIX shell. Use {@link #exec(String)} for anything the helpers don't cover.
 */
@Slf4j
public class SshMachineVerifier {

    private static final int EXEC_TIMEOUT_SECONDS = 30;

    private final String host;
    private final int port;
    private final String user;
    private final String password;
    private final MachineOs os;

    public SshMachineVerifier() {
        this(MachineConfig.getSshHost(), MachineConfig.getSshPort(),
                MachineConfig.getSshUser(), MachineConfig.getSshPassword(), MachineConfig.getOs());
    }

    /** Verifier for the optional control machine (shares the primary's SSH port/user/password/OS). */
    public static SshMachineVerifier control() {
        return new SshMachineVerifier(MachineConfig.getControlSshHost(), MachineConfig.getSshPort(),
                MachineConfig.getSshUser(), MachineConfig.getSshPassword(), MachineConfig.getOs());
    }

    public SshMachineVerifier(String host, int port, String user, String password, MachineOs os) {
        this.host = host;
        this.port = port;
        this.user = user;
        this.password = password;
        this.os = os;
    }

    @Getter
    @AllArgsConstructor
    public static class ExecResult {
        private final int exitStatus;
        private final String stdout;
        private final String stderr;

        public boolean ok() {
            return exitStatus == 0;
        }
    }

    public MachineOs os() {
        return os;
    }

    /** OS-appropriate scratch directory for throwaway files ({@code C:\Temp} or {@code /tmp}). */
    public String tempDir() {
        return os == MachineOs.WINDOWS ? "C:\\Temp" : "/tmp";
    }

    /** OS-appropriate throwaway file path for a run token, e.g. {@code C:\Temp\e2e-ab12cd.txt} or {@code /tmp/e2e-ab12cd.txt}. */
    public String tempFilePath(String name) {
        String sep = os == MachineOs.WINDOWS ? "\\" : "/";
        return tempDir() + sep + name + ".txt";
    }

    /**
     * Ensures {@link #tempDir()} exists so the assistant's write has a valid parent directory. This is
     * test setup over channel B, not part of what FILE-01 verifies — the case proves the assistant can
     * create a <em>file</em>, and a missing scratch dir would be an infra gap, not a product failure.
     * Idempotent ({@code mkdir -p} / {@code New-Item -Force}).
     */
    public void ensureTempDir() {
        String dir = tempDir();
        String cmd = switch (os) {
            case WINDOWS -> "New-Item -ItemType Directory -Force -Path " + psq(dir) + " | Out-Null";
            case LINUX -> "mkdir -p " + shq(dir);
        };
        ExecResult r = exec(cmd);
        if (!r.ok()) {
            throw new InfraFailureException("Failed to ensure scratch dir " + dir + ": " + r.getStderr());
        }
    }

    /**
     * Runs a command over a fresh SSH session. Connection/transport problems abort as infra.
     *
     * <p>On Windows the command (raw PowerShell) is wrapped as {@code powershell -EncodedCommand <base64>}
     * so it runs correctly regardless of the box's default OpenSSH shell — some machines default to
     * {@code cmd.exe}, others to PowerShell — and so no cross-shell quoting can corrupt it.
     */
    public ExecResult exec(String command) {
        String actual = os == MachineOs.WINDOWS ? wrapPowerShell(command) : command;
        SSHClient ssh = new SSHClient();
        try {
            ssh.addHostKeyVerifier(new PromiscuousVerifier());
            ssh.connect(host, port);
            ssh.authPassword(user, password);
            try (Session session = ssh.startSession()) {
                Session.Command cmd = session.exec(actual);
                String out = IOUtils.readFully(cmd.getInputStream()).toString();
                String err = IOUtils.readFully(cmd.getErrorStream()).toString();
                cmd.join(EXEC_TIMEOUT_SECONDS, TimeUnit.SECONDS);
                Integer status = cmd.getExitStatus();
                return new ExecResult(status == null ? -1 : status, out, err);
            }
        } catch (Exception e) {
            throw new InfraFailureException(
                    "SSH to " + user + "@" + host + ":" + port + " failed: " + e.getMessage(), e);
        } finally {
            try {
                ssh.disconnect();
            } catch (Exception ignored) {
                // best effort
            }
        }
    }

    /** Returns file contents. Empty when the file is absent — the caller asserts. Trailing newline is left to the caller to trim. */
    public String readFile(String path) {
        String cmd = switch (os) {
            case WINDOWS -> "Get-Content -Raw -LiteralPath " + psq(path);
            case LINUX -> "cat " + shq(path);
        };
        return exec(cmd).getStdout();
    }

    public boolean fileExists(String path) {
        String cmd = switch (os) {
            case WINDOWS -> "if (Test-Path -LiteralPath " + psq(path) + " -PathType Leaf) { exit 0 } else { exit 1 }";
            case LINUX -> "test -f " + shq(path);
        };
        return exec(cmd).ok();
    }

    public boolean dirExists(String path) {
        String cmd = switch (os) {
            case WINDOWS -> "if (Test-Path -LiteralPath " + psq(path) + " -PathType Container) { exit 0 } else { exit 1 }";
            case LINUX -> "test -d " + shq(path);
        };
        return exec(cmd).ok();
    }

    /**
     * Whether a service is currently running. Ground truth for the service-state cases — taken over SSH at
     * assertion time, never from the assistant's prose. Windows reads {@code Get-Service .Status}; Linux
     * uses {@code systemctl is-active}.
     */
    public boolean serviceRunning(String name) {
        return switch (os) {
            case WINDOWS -> exec("(Get-Service -Name " + psq(name) + ").Status").getStdout().trim().equalsIgnoreCase("Running");
            case LINUX -> exec("systemctl is-active " + shq(name)).getStdout().trim().equals("active");
        };
    }

    /** Seeds a file with exact content (no trailing newline). */
    public void writeFile(String path, String content) {
        String cmd = switch (os) {
            case WINDOWS -> "Set-Content -LiteralPath " + psq(path) + " -Value " + psq(content)
                    + " -NoNewline -Encoding utf8";
            case LINUX -> "printf '%s' " + shq(content) + " > " + shq(path);
        };
        ExecResult r = exec(cmd);
        if (!r.ok()) {
            throw new InfraFailureException("Failed to seed file " + path + ": " + r.getStderr());
        }
    }

    public void deleteQuietly(String path) {
        String cmd = switch (os) {
            case WINDOWS -> "Remove-Item -LiteralPath " + psq(path) + " -Force -ErrorAction SilentlyContinue";
            case LINUX -> "rm -f " + shq(path);
        };
        try {
            exec(cmd);
        } catch (RuntimeException e) {
            log.warn("deleteQuietly({}) failed: {}", path, e.getMessage());
        }
    }

    /** Recursively removes a directory tree. Best-effort teardown for the mkdir cases. */
    public void deleteDirQuietly(String path) {
        String cmd = switch (os) {
            case WINDOWS -> "Remove-Item -LiteralPath " + psq(path) + " -Recurse -Force -ErrorAction SilentlyContinue";
            case LINUX -> "rm -rf " + shq(path);
        };
        try {
            exec(cmd);
        } catch (RuntimeException e) {
            log.warn("deleteDirQuietly({}) failed: {}", path, e.getMessage());
        }
    }

    /** Reachability probe used as an up-front infra check. {@code hostname} works on both Windows and Linux. */
    public String hostname() {
        return exec("hostname").getStdout().trim();
    }

    /** OS build number — ground truth for the OS-version case (e.g. Windows build {@code 20348}). */
    public String osBuild() {
        return switch (os) {
            case WINDOWS -> exec("[System.Environment]::OSVersion.Version.Build").getStdout().trim();
            case LINUX -> exec("uname -r").getStdout().trim();
        };
    }

    /** Free space on the system drive in whole GB — ground truth for the disk-space case. */
    public long freeDiskGb() {
        String out = switch (os) {
            case WINDOWS -> exec("[math]::Round((Get-PSDrive C).Free/1GB)").getStdout().trim();
            case LINUX -> exec("df -BG --output=avail / | tail -1 | tr -dc '0-9'").getStdout().trim();
        };
        try {
            return Long.parseLong(out.replaceAll("[^0-9]", ""));
        } catch (NumberFormatException e) {
            throw new InfraFailureException("Could not read free disk space (got '" + out + "')");
        }
    }

    /** Wraps a PowerShell script as {@code powershell -EncodedCommand <base64 UTF-16LE>} (shell-independent). */
    private static String wrapPowerShell(String psScript) {
        String encoded = Base64.getEncoder().encodeToString(psScript.getBytes(StandardCharsets.UTF_16LE));
        return "powershell -NoProfile -NonInteractive -EncodedCommand " + encoded;
    }

    /** POSIX single-quote escaping: wrap in single quotes and escape embedded single quotes. */
    private static String shq(String s) {
        return "'" + s.replace("'", "'\\''") + "'";
    }

    /** PowerShell single-quote (literal) escaping: wrap in single quotes and double embedded single quotes. */
    private static String psq(String s) {
        return "'" + s.replace("'", "''") + "'";
    }
}
