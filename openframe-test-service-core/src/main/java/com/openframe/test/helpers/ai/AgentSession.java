package com.openframe.test.helpers.ai;

import com.openframe.test.api.AgentAuthApi;
import com.openframe.test.helpers.RequestSpecHelper;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

/**
 * Acts as the machine's own agent for the duration of a block: reads the machine's client credentials
 * over SSH, exchanges them for an AGENT access token, and installs it as this thread's actor so every
 * {@code api/*} call is made as that agent.
 *
 * <p>This is the whole auth delta for the client-assistant suite. The admin cases run as a cookie-based
 * ADMIN session; an AGENT presents a bearer token instead, and its {@code machine_id} claim is the only
 * thing that decides which machine the assistant acts on — the client tools take no machine argument.
 *
 * <p>Scope it narrowly. Preconditions that need ADMIN (device lookups, ticket/dialog reads) must run
 * <em>outside</em> the session, because while it is open this thread has no ADMIN identity at all:
 * <pre>{@code
 * Machine target = MachineFixture.requireOnlineTarget(ssh);   // ADMIN
 * try (AgentSession agent = AgentSession.open(ssh)) {         // AGENT from here
 *     ...
 * }                                                           // ADMIN again
 * }</pre>
 */
@Slf4j
public final class AgentSession implements AutoCloseable {

    /** The machine this session is bound to, as claimed by the token it installed. */
    @Getter
    private final String machineId;

    private AgentSession(String machineId) {
        this.machineId = machineId;
    }

    /**
     * Opens a session as the agent installed on the machine behind {@code ssh}.
     * <p>
     * Nested sessions are refused rather than silently stacked: {@link #close()} restores the ADMIN
     * actor unconditionally, so an inner session closing would strand the outer one acting as ADMIN.
     */
    public static AgentSession open(SshMachineVerifier ssh) {
        if (RequestSpecHelper.hasBearerToken()) {
            throw new IllegalStateException(
                    "An AgentSession is already open on this thread; close it before opening another");
        }

        AgentIdentity identity = AgentIdentity.readFrom(ssh);
        String token = AgentAuthApi.getClientCredentialsToken(identity.clientId(), identity.clientSecret());
        RequestSpecHelper.setBearerToken(token);
        log.info("Acting as AGENT for machine {}", identity.machineId());
        return new AgentSession(identity.machineId());
    }

    /** Restores the cookie-based ADMIN actor. Idempotent, and safe to call after a failure. */
    @Override
    public void close() {
        RequestSpecHelper.clearBearerToken();
        log.info("Released AGENT session for machine {}; acting as ADMIN again", machineId);
    }
}
