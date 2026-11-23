package com.openframe.gateway.config.ws;

import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketSession;
import org.springframework.web.server.ServerWebExchange;
import tools.jackson.databind.ObjectMapper;

import java.util.Optional;

/**
 * Wraps a NATS websocket session with {@link NatsSubjectFilteringWebSocketSessionDecorator} for the
 * client the accepted JWT identifies.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NatsSubjectFilter {

    private final NatsSubjectFilterProperties natsSubjectFilterProperties;
    private final RequestJwtClaimsReader requestJwtClaimsReader;
    private final ObjectMapper objectMapper;
    private final GatewayTrafficMetrics gatewayTrafficMetrics;

    @PostConstruct
    void logState() {
        log.info("NATS subject filter: enabled={} enforce={}",
                natsSubjectFilterProperties.isEnabled(), natsSubjectFilterProperties.isEnforce());
    }

    public boolean isEnabledFor(String path) {
        return natsSubjectFilterProperties.isEnabled() && natsSubjectFilterProperties.isNatsPath(path);
    }

    /**
     * A token the identity cannot be read from (no {@code machine_id}, {@code userId} or {@code sub})
     * leaves the session unfiltered rather than closed: the gateway already accepted that token, and
     * the observation phase must never cut a client.
     */
    public WebSocketSession decorate(ServerWebExchange exchange, WebSocketSession session, String path, String tenant) {
        NatsClientIdentity identity;
        try {
            identity = identityOf(exchange);
        } catch (IllegalStateException e) {
            log.warn("NATS client identity unknown, relaying unfiltered: {} path={} tenant={}", e.getMessage(), path, tenant);
            return session;
        }
        return new NatsSubjectFilteringWebSocketSessionDecorator(session, path, tenant, identity,
                natsSubjectFilterProperties, objectMapper, gatewayTrafficMetrics);
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
