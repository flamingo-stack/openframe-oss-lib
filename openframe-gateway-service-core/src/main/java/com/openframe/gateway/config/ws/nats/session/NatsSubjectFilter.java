package com.openframe.gateway.config.ws.nats.session;

import com.openframe.gateway.config.ws.nats.NatsClientContext;
import com.openframe.gateway.config.ws.nats.NatsClientContextFactory;
import com.openframe.gateway.config.ws.nats.NatsSubjectFilterProperties;
import com.openframe.gateway.config.ws.nats.protocol.NatsCommandAssembler;
import com.openframe.gateway.config.ws.nats.protocol.NatsControlLineParser;
import com.openframe.gateway.config.ws.nats.validation.NatsCommandValidationService;
import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.route.Route;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketSession;
import org.springframework.web.server.ServerWebExchange;
import reactor.util.context.ContextView;

import java.util.Optional;

import static com.openframe.gateway.config.ws.WebSocketGatewayConfig.NATS_ROUTE_IDS;
import static org.springframework.cloud.gateway.support.ServerWebExchangeUtils.GATEWAY_ROUTE_ATTR;

/**
 * Wraps a NATS websocket session with {@link NatsSubjectFilteringWebSocketSessionDecorator} for the
 * client the accepted JWT identifies. Whether a session is a NATS session is read from the route
 * Spring Cloud Gateway matched, so routing and filtering can never disagree about it.
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

    public boolean isEnabledFor(ServerWebExchange exchange) {
        return natsSubjectFilterProperties.isEnabled() && isNatsRoute(exchange);
    }

    public WebSocketSession decorate(ServerWebExchange exchange, WebSocketSession session, String path, String tenant,
                                     ContextView reactorContext) {
        NatsClientContext context;
        try {
            context = natsClientContextFactory.create(exchange, path, tenant, reactorContext);
        } catch (IllegalStateException e) {
            return relayUnfiltered(session, path, tenant, e);
        }
        long maxPayloadBytes = natsSubjectFilterProperties.getMaxPayloadBytes();
        NatsCommandAssembler assembler = new NatsCommandAssembler(natsControlLineParser, maxPayloadBytes);
        NatsRefusalReporter reporter = new NatsRefusalReporter(gatewayTrafficMetrics, context);
        return new NatsSubjectFilteringWebSocketSessionDecorator(session, context, natsSubjectFilterProperties,
                assembler, natsCommandValidationService, reporter);
    }

    private static boolean isNatsRoute(ServerWebExchange exchange) {
        Optional<Route> route = Optional.ofNullable(exchange.getAttribute(GATEWAY_ROUTE_ATTR));
        return route
                .map(Route::getId)
                .map(NATS_ROUTE_IDS::contains)
                .orElse(false);
    }

    /**
     * A token the identity cannot be read from (no {@code machine_id}, {@code userId} or {@code sub})
     * leaves the session unfiltered rather than closed: the gateway already accepted that token, and
     * the observation phase must never cut a client.
     */
    private static WebSocketSession relayUnfiltered(WebSocketSession session, String path, String tenant,
                                                    IllegalStateException cause) {
        log.warn("NATS client identity unknown, relaying unfiltered: {} path={} tenant={}", cause.getMessage(), path, tenant);
        return session;
    }
}
