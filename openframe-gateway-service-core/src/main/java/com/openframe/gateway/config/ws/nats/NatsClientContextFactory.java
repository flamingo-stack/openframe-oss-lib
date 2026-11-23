package com.openframe.gateway.config.ws.nats;

import com.openframe.gateway.config.ws.RequestJwtClaimsReader;
import com.openframe.gateway.config.ws.nats.policy.NatsSubjectPolicy;
import com.openframe.gateway.config.ws.nats.policy.NatsSubjectPolicyFactory;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.util.context.ContextView;

import java.util.Optional;

/**
 * Builds the {@link NatsClientContext} of a session once, at the upgrade. Every client logs in to
 * NATS as the same shared user, so the only thing that tells one client from another is the JWT
 * the gateway accepted; the policy that scopes its subjects can only be compiled once that identity
 * is known, and it is compiled here so no validator parses a token again.
 */
@Component
@RequiredArgsConstructor
public class NatsClientContextFactory {

    private final RequestJwtClaimsReader requestJwtClaimsReader;
    private final NatsSubjectPolicyFactory natsSubjectPolicyFactory;

    /**
     * @throws IllegalStateException when the token carries neither a machine nor a user identity.
     */
    public NatsClientContext create(ServerWebExchange exchange, String path, String tenantId, ContextView reactorContext) {
        NatsClientIdentity identity = identityOf(exchange);
        NatsSubjectPolicy policy = natsSubjectPolicyFactory.policyFor(identity);
        return NatsClientContext.builder()
                .identity(identity)
                .tenantId(tenantId)
                .path(path)
                .policy(policy)
                .reactorContext(reactorContext)
                .build();
    }

    private NatsClientIdentity identityOf(ServerWebExchange exchange) {
        Optional<String> machineId = requestJwtClaimsReader.getMachineId(exchange);
        return machineId
                .map(NatsClientIdentity::device)
                .orElseGet(() -> userIdentityOf(exchange));
    }

    private NatsClientIdentity userIdentityOf(ServerWebExchange exchange) {
        String userId = requestJwtClaimsReader.getUserId(exchange);
        return NatsClientIdentity.user(userId);
    }
}
