package com.openframe.gateway.config.ws.nats;

import com.openframe.gateway.config.ws.nats.jetstream.SessionConsumerRegistry;
import com.openframe.gateway.config.ws.nats.policy.NatsSubjectPolicy;
import lombok.Builder;
import lombok.Value;
import reactor.util.context.ContextView;

/**
 * Everything a validator needs to know about one NATS websocket session: who the client is, which
 * tenant it belongs to, what it may publish and subscribe to, which JetStream consumers it created
 * here, and the Reactor context of the upgrade request, so a validator that reads the database
 * runs under the same tenant routing.
 */
@Value
@Builder
public class NatsClientContext {

    NatsClientIdentity identity;
    String tenantId;
    String path;
    NatsSubjectPolicy policy;
    SessionConsumerRegistry consumerRegistry;
    ContextView reactorContext;

    public NatsClientKind getKind() {
        return identity.getKind();
    }

    public String getClientId() {
        return identity.getId();
    }

    public boolean isDevice() {
        return identity.getKind() == NatsClientKind.DEVICE;
    }
}
