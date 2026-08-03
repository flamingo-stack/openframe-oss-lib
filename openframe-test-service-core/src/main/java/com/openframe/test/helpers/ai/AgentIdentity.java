package com.openframe.test.helpers.ai;

import com.openframe.test.config.MachineOs;
import io.restassured.path.json.JsonPath;
import lombok.extern.slf4j.Slf4j;

/**
 * The client credentials an enrolled agent holds for itself, read off the machine over SSH.
 *
 * <p>There is no API that hands these out: the secret is stored bcrypt-hashed in the {@code OAuthClient}
 * record, so it cannot be recovered from the backend — the only copy in the clear is the one the agent
 * wrote to its own disk at registration. Reading it over channel B (the same SSH the verifier uses) is
 * therefore how a test obtains a genuine AGENT identity, and it also means the identity is
 * <em>necessarily</em> the machine under test: the credentials came off that box.
 *
 * <p>Written by the Rust client's {@code AgentConfigurationService} to
 * {@code <secured_dir>/agent_config.json}, holding {@code machine_id}, {@code client_id} and
 * {@code client_secret} (plus its live tokens, which we deliberately do not reuse — a test minting its
 * own token cannot disturb the agent's session).
 */
@Slf4j
public record AgentIdentity(String machineId, String clientId, String clientSecret) {

    /**
     * Where the agent keeps {@code agent_config.json}, per {@code get_secured_directory()} in the
     * client's {@code platform/directories.rs}. macOS ({@code /Library/Application Support/OpenFrame})
     * has no {@link MachineOs} constant, so it is not represented here.
     */
    private static final String WINDOWS_CONFIG = "C:\\ProgramData\\OpenFrame\\secured\\agent_config.json";
    private static final String LINUX_CONFIG = "/var/lib/openframe/secured/agent_config.json";

    /**
     * Reads the agent identity off the machine behind the given verifier.
     *
     * @throws InfraFailureException if the file is missing or unreadable — that is an enrollment or
     *                               SSH-privilege problem on the fixture side, never a product failure.
     *                               The directory is root/SYSTEM-owned ("secured"), so the SSH user must
     *                               be privileged enough to read it.
     */
    public static AgentIdentity readFrom(SshMachineVerifier ssh) {
        String path = configPath(ssh.os());
        String json = ssh.readFile(path).trim();
        if (json.isEmpty()) {
            throw new InfraFailureException(String.format(
                    "Could not read the agent config at %s — the machine is either not enrolled, or the "
                            + "SSH user cannot read the secured directory. Without it there is no AGENT "
                            + "identity to run the client-assistant cases as.", path));
        }

        JsonPath parsed = JsonPath.from(json);
        AgentIdentity identity = new AgentIdentity(
                parsed.getString("machine_id"),
                parsed.getString("client_id"),
                parsed.getString("client_secret"));

        if (isBlank(identity.machineId) || isBlank(identity.clientId) || isBlank(identity.clientSecret)) {
            throw new InfraFailureException(String.format(
                    "The agent config at %s is missing machine_id/client_id/client_secret "
                            + "(machine_id=%s, client_id present=%s, client_secret present=%s) — "
                            + "registration likely did not complete.",
                    path, identity.machineId, !isBlank(identity.clientId), !isBlank(identity.clientSecret)));
        }

        // machineId only; the secret must never reach the log.
        log.info("Read agent identity from {}: machineId={}", path, identity.machineId);
        return identity;
    }

    private static String configPath(MachineOs os) {
        return switch (os) {
            case WINDOWS -> WINDOWS_CONFIG;
            case LINUX -> LINUX_CONFIG;
        };
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    /** Redacts the secret — this record is a credential and must stay unprintable. */
    @Override
    public String toString() {
        return "AgentIdentity[machineId=" + machineId + ", clientId=" + clientId + ", clientSecret=<redacted>]";
    }
}
