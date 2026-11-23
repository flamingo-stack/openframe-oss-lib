package com.openframe.gateway.config.ws.nats.session;

import com.openframe.gateway.config.ws.nats.NatsClientContextFactory;
import com.openframe.gateway.config.ws.nats.NatsSubjectFilterProperties;
import com.openframe.gateway.config.ws.nats.NatsTestContexts;
import com.openframe.gateway.config.ws.nats.protocol.NatsControlLineParser;
import com.openframe.gateway.config.ws.nats.validation.NatsCommandValidationService;
import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cloud.gateway.route.Route;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.reactive.socket.CloseStatus;
import org.springframework.web.reactive.socket.WebSocketSession;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.util.context.Context;
import reactor.util.context.ContextView;

import java.net.URI;

import static com.openframe.gateway.config.ws.WebSocketGatewayConfig.NATS_ROUTE_IDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.cloud.gateway.support.ServerWebExchangeUtils.GATEWAY_ROUTE_ATTR;

@ExtendWith(MockitoExtension.class)
class NatsSubjectFilterTest {

    private static final String NATS_PATH = "/ws/nats";
    private static final String TENANT = "tenant-1";
    private static final ContextView CONTEXT = Context.empty();
    private static final URI NATS_URI = URI.create("ws://nats.tenant-ns.svc.cluster.local:8080");

    @Mock private NatsClientContextFactory natsClientContextFactory;
    @Mock private NatsCommandValidationService natsCommandValidationService;
    @Mock private GatewayTrafficMetrics gatewayTrafficMetrics;
    @Mock private WebSocketSession session;

    private NatsSubjectFilterProperties properties;
    private NatsSubjectFilter natsSubjectFilter;

    @BeforeEach
    void setUp() {
        properties = new NatsSubjectFilterProperties();
        properties.setEnabled(true);
        natsSubjectFilter = new NatsSubjectFilter(properties, natsClientContextFactory, new NatsControlLineParser(),
                natsCommandValidationService, gatewayTrafficMetrics);
    }

    @ParameterizedTest
    @ValueSource(strings = {"nats_websocket_route", "nats_api_websocket_route"})
    void isEnabledFor_requestRoutedToNats_true(String routeId) {
        // setup
        ServerWebExchange exchange = exchangeRoutedBy(routeId);

        // execution
        boolean enabled = natsSubjectFilter.isEnabledFor(exchange);

        // verifications
        assertThat(enabled).isTrue();
    }

    @Test
    void isEnabledFor_everyNatsRouteId_true() {
        // execution
        boolean allEnabled = NATS_ROUTE_IDS.stream()
                .map(NatsSubjectFilterTest::exchangeRoutedBy)
                .allMatch(natsSubjectFilter::isEnabledFor);

        // verifications
        assertThat(allEnabled).isTrue();
    }

    @Test
    void isEnabledFor_requestRoutedElsewhere_false() {
        // setup
        ServerWebExchange exchange = exchangeRoutedBy("api_gateway_websocket_route");

        // execution
        boolean enabled = natsSubjectFilter.isEnabledFor(exchange);

        // verifications
        assertThat(enabled).isFalse();
    }

    @Test
    void isEnabledFor_requestWithoutAMatchedRoute_false() {
        // setup
        ServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest.get(NATS_PATH).build());

        // execution
        boolean enabled = natsSubjectFilter.isEnabledFor(exchange);

        // verifications
        assertThat(enabled).isFalse();
    }

    @Test
    void isEnabledFor_natsRouteWhileDisabled_false() {
        // setup
        properties.setEnabled(false);
        ServerWebExchange exchange = exchangeRoutedBy("nats_websocket_route");

        // execution
        boolean enabled = natsSubjectFilter.isEnabledFor(exchange);

        // verifications
        assertThat(enabled).isFalse();
    }

    @Test
    void decorate_identityKnown_filteringDecorator() {
        // setup
        ServerWebExchange exchange = exchangeRoutedBy("nats_websocket_route");
        when(natsClientContextFactory.create(exchange, NATS_PATH, TENANT, CONTEXT)).thenReturn(NatsTestContexts.device());

        // execution
        WebSocketSession decorated = natsSubjectFilter.decorate(exchange, session, NATS_PATH, TENANT, CONTEXT);

        // verifications
        assertThat(decorated).isInstanceOf(NatsSubjectFilteringWebSocketSessionDecorator.class);
    }

    @Test
    void decorate_tokenWithoutIdentityObserving_sessionRelayedUnfiltered() {
        // setup
        ServerWebExchange exchange = exchangeRoutedBy("nats_websocket_route");
        when(natsClientContextFactory.create(exchange, NATS_PATH, TENANT, CONTEXT))
                .thenThrow(new IllegalStateException("no role"));

        // execution
        WebSocketSession decorated = natsSubjectFilter.decorate(exchange, session, NATS_PATH, TENANT, CONTEXT);

        // verifications
        assertThat(decorated).isSameAs(session);
        verify(session, never()).close(CloseStatus.POLICY_VIOLATION);
    }

    @Test
    void decorate_tokenWithoutIdentityEnforcing_sessionClosed() {
        // setup
        properties.setEnforce(true);
        ServerWebExchange exchange = exchangeRoutedBy("nats_websocket_route");
        when(natsClientContextFactory.create(exchange, NATS_PATH, TENANT, CONTEXT))
                .thenThrow(new IllegalStateException("no role"));
        when(session.close(CloseStatus.POLICY_VIOLATION)).thenReturn(Mono.empty());

        // execution
        natsSubjectFilter.decorate(exchange, session, NATS_PATH, TENANT, CONTEXT);

        // verifications
        verify(session).close(CloseStatus.POLICY_VIOLATION);
    }

    private static ServerWebExchange exchangeRoutedBy(String routeId) {
        MockServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest.get(NATS_PATH).build());
        Route route = Route.async().id(routeId).uri(NATS_URI).predicate(request -> true).build();
        exchange.getAttributes().put(GATEWAY_ROUTE_ATTR, route);
        return exchange;
    }
}
