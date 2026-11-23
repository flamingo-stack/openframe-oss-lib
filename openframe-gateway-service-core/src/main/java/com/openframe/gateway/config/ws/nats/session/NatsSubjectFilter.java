package com.openframe.gateway.config.ws.nats.session;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.NatsClientContextFactory;
import com.openframe.gateway.config.ws.nats.NatsSubjectFilterProperties;
import com.openframe.gateway.config.ws.nats.validation.NatsCommandValidationService;
import com.openframe.gateway.config.ws.nats.protocol.NatsCommandAssembler;
import com.openframe.gateway.config.ws.nats.protocol.NatsControlLineParser;
import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketSession;
import org.springframework.web.server.ServerWebExchange;
import reactor.util.context.ContextView;

/**
 * Wraps a NATS websocket session with {@link NatsSubjectFilteringWebSocketSessionDecorator} for the
 * client the accepted JWT identifies.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NatsSubjectFilter {

    private final NatsSubjectFilterProperties natsSubjectFilterProperties;
    private final NatsClientContextFactory natsClientContextFactory;
    private final NatsControlLineParser natsControlLineParser;
    private final NatsCommandValidationService natsCommandValidationService;
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
    public WebSocketSession decorate(ServerWebExchange exchange, WebSocketSession session, String path, String tenant,
                                     ContextView reactorContext) {
        NatsClientContext context;
        try {
            context = natsClientContextFactory.create(exchange, path, tenant, reactorContext);
        } catch (IllegalStateException e) {
            log.warn("NATS client identity unknown, relaying unfiltered: {} path={} tenant={}", e.getMessage(), path, tenant);
            return session;
        }
        long maxPayloadBytes = natsSubjectFilterProperties.getMaxPayloadBytes();
        NatsCommandAssembler assembler = new NatsCommandAssembler(natsControlLineParser, maxPayloadBytes);
        NatsRefusalReporter reporter = new NatsRefusalReporter(gatewayTrafficMetrics, context);
        return new NatsSubjectFilteringWebSocketSessionDecorator(session, context, natsSubjectFilterProperties,
                assembler, natsCommandValidationService, reporter);
    }
}
