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

    public WebSocketSession decorate(ServerWebExchange exchange, WebSocketSession session, String path, String tenant) {
        NatsClientIdentity identity = identityOf(exchange);
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
