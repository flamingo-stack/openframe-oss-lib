package com.openframe.gateway.config.ws.nats;

import com.openframe.gateway.config.ws.RequestJwtClaimsReader;
import com.openframe.gateway.config.ws.nats.jetstream.SessionConsumerRegistry;
import com.openframe.gateway.config.ws.nats.policy.NatsSubjectPolicy;
import com.openframe.gateway.config.ws.nats.policy.NatsSubjectPolicyFactory;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.util.context.ContextView;

import java.util.List;

/**
 * Builds the {@link NatsClientContext} of a session once, at the upgrade. Every client logs in to
 * NATS as the same shared user, so the only thing that tells one client from another is the JWT
 * the gateway accepted: its role says what kind of client this is ({@code AGENT} with a
 * {@code machine_id} is a device, {@code ADMIN} is a user), and the policy that scopes its subjects
 * can only be compiled once that identity is known. A token that fits neither has no identity here.
 */
@Component
@RequiredArgsConstructor
public class NatsClientContextFactory {

    static final String AGENT_ROLE = "AGENT";
    static final String ADMIN_ROLE = "ADMIN";

    private final RequestJwtClaimsReader requestJwtClaimsReader;
    private final NatsSubjectPolicyFactory natsSubjectPolicyFactory;

    /**
     * @throws IllegalStateException when the token carries neither a device nor an admin identity,
     * or an id that cannot be one subject token.
     */
    public NatsClientContext create(ServerWebExchange exchange, String path, String tenantId, ContextView reactorContext) {
        NatsClientIdentity identity = identityOf(exchange);
        NatsSubjectPolicy policy = natsSubjectPolicyFactory.policyFor(identity);
        return NatsClientContext.builder()
                .identity(identity)
                .tenantId(tenantId)
                .path(path)
                .policy(policy)
                .consumerRegistry(new SessionConsumerRegistry())
                .reactorContext(reactorContext)
                .build();
    }

    private NatsClientIdentity identityOf(ServerWebExchange exchange) {
        List<String> roles = requestJwtClaimsReader.getRoles(exchange);
        if (roles.contains(AGENT_ROLE)) {
            return deviceIdentityOf(exchange);
        }
        if (roles.contains(ADMIN_ROLE)) {
            return userIdentityOf(exchange);
        }
        throw new IllegalStateException("Token carries neither the AGENT nor the ADMIN role: " + roles);
    }

    private NatsClientIdentity deviceIdentityOf(ServerWebExchange exchange) {
        return requestJwtClaimsReader.getMachineId(exchange)
                .map(NatsClientIdentity::device)
                .orElseThrow(() -> new IllegalStateException("AGENT token carries no machine_id"));
    }

    private NatsClientIdentity userIdentityOf(ServerWebExchange exchange) {
        String userId = requestJwtClaimsReader.getUserId(exchange);
        return NatsClientIdentity.user(userId);
    }
}
