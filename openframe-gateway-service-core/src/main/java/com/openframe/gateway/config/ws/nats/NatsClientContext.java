package com.openframe.gateway.config.ws.nats;

import com.openframe.gateway.config.ws.nats.policy.NatsSubjectPolicy;
import reactor.util.context.ContextView;

/**
 * Everything a check needs to know about one NATS websocket session: who the client is, which
 * tenant it belongs to, what it may publish and subscribe to, and the Reactor context of the
 * upgrade request, so a check that reads the database runs under the same tenant routing.
 */
public record NatsClientContext(
        NatsClientIdentity identity,
        String tenantId,
        String path,
        NatsSubjectPolicy policy,
        ContextView reactorContext
) {

    public NatsClientKind kind() {
        return identity.kind();
    }

    public String clientId() {
        return identity.id();
    }

    public boolean isDevice() {
        return identity.kind() == NatsClientKind.DEVICE;
    }
}
