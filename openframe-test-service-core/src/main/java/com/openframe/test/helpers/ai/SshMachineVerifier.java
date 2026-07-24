package com.openframe.test.helpers.ai;

import com.openframe.test.config.MachineConfig;
import com.openframe.test.config.MachineOs;
import net.schmizz.sshj.SSHClient;
import net.schmizz.sshj.common.IOUtils;
import net.schmizz.sshj.connection.channel.direct.Session;
import net.schmizz.sshj.transport.verification.PromiscuousVerifier;
import lombok.extern.slf4j.Slf4j;

import java.util.concurrent.TimeUnit;

/**
 * Channel B for device cases: an independent SSH connection to the target box used to verify what the
 * assistant actually did. Any transport failure here is an {@link InfraFailureException}, never an
 * assertion failure — if we cannot reach the box we do not know whether the assistant did its job.
 *
 * <p>File helpers adapt to the target OS ({@link MachineOs}). The provisioned fleet is Windows: OpenSSH
 * with <b>PowerShell as the default shell</b> (the same assumption the repo's {@code run-remote-install.sh}
 * relies on when it pipes PowerShell cmdlets straight through {@code ssh}), so Windows commands are raw
 * PowerShell. Linux uses a POSIX shell. Use {@link #exec(String)} for anything the helpers don't cover.
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

    public SshMachineVerifier(String host, int port, String user, String password, MachineOs os) {
        this.host = host;
        this.port = port;
        this.user = user;
        this.password = password;
        this.os = os;
    }

    public record ExecResult(int exitStatus, String stdout, String stderr) {
        public boolean ok() {
            return exitStatus == 0;
        }
    }

    public MachineOs os() {
        return os;
    }

    /** OS-appropriate throwaway file path for a run token, e.g. {@code C:\Temp\e2e-ab12cd.txt} or {@code /tmp/e2e-ab12cd.txt}. */
    public String tempFilePath(String name) {
        return os == MachineOs.WINDOWS ? "C:\\Temp\\" + name + ".txt" : "/tmp/" + name + ".txt";
    }

    /** Runs a command over a fresh SSH session. Connection/transport problems abort as infra. */
    public ExecResult exec(String command) {
        SSHClient ssh = new SSHClient();
        try {
            ssh.addHostKeyVerifier(new PromiscuousVerifier());
            ssh.connect(host, port);
            ssh.authPassword(user, password);
            try (Session session = ssh.startSession()) {
                Session.Command cmd = session.exec(command);
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
        return exec(cmd).stdout();
    }

    public boolean fileExists(String path) {
        String cmd = switch (os) {
            case WINDOWS -> "if (Test-Path -LiteralPath " + psq(path) + ") { exit 0 } else { exit 1 }";
            case LINUX -> "test -f " + shq(path);
        };
        return exec(cmd).ok();
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
            throw new InfraFailureException("Failed to seed file " + path + ": " + r.stderr());
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

    /** Reachability probe used as an up-front infra check. {@code hostname} works on both Windows and Linux. */
    public String hostname() {
        return exec("hostname").stdout().trim();
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
