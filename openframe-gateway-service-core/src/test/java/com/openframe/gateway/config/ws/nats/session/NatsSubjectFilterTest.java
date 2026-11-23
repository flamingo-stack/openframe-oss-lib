package com.openframe.gateway.config.ws.nats.session;

import com.openframe.gateway.config.ws.nats.NatsClientContextFactory;
import com.openframe.gateway.config.ws.nats.NatsSubjectFilterProperties;
import com.openframe.gateway.config.ws.nats.NatsTestContexts;
import com.openframe.gateway.config.ws.nats.validation.NatsCommandValidationService;
import com.openframe.gateway.config.ws.nats.protocol.NatsControlLineParser;
import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.reactive.socket.WebSocketSession;
import org.springframework.web.server.ServerWebExchange;
import reactor.util.context.Context;
import reactor.util.context.ContextView;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NatsSubjectFilterTest {

    private static final String NATS_PATH = "/ws/nats";
    private static final String TENANT = "tenant-1";
    private static final ContextView CONTEXT = Context.empty();

    @Mock private NatsClientContextFactory natsClientContextFactory;
    @Mock private NatsCommandValidationService natsCommandValidationService;
    @Mock private GatewayTrafficMetrics gatewayTrafficMetrics;
    @Mock private ServerWebExchange exchange;
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
    @ValueSource(strings = {"/ws/nats", "/ws/nats-api"})
    void isEnabledFor_natsPathWhileEnabled_true(String path) {
        // execution
        boolean enabled = natsSubjectFilter.isEnabledFor(path);

        // verifications
        assertThat(enabled).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"/ws/tools/meshcentral-server/control.ashx", "/ws/nats-logs", "/ws/nats/"})
    void isEnabledFor_otherPath_false(String path) {
        // execution
        boolean enabled = natsSubjectFilter.isEnabledFor(path);

        // verifications
        assertThat(enabled).isFalse();
    }

    @Test
    void isEnabledFor_natsPathWhileDisabled_false() {
        // setup
        properties.setEnabled(false);

        // execution
        boolean enabled = natsSubjectFilter.isEnabledFor(NATS_PATH);

        // verifications
        assertThat(enabled).isFalse();
    }

    @Test
    void decorate_identityKnown_filteringDecorator() {
        // setup
        when(natsClientContextFactory.create(exchange, NATS_PATH, TENANT, CONTEXT)).thenReturn(NatsTestContexts.device());

        // execution
        WebSocketSession decorated = natsSubjectFilter.decorate(exchange, session, NATS_PATH, TENANT, CONTEXT);

        // verifications
        assertThat(decorated).isInstanceOf(NatsSubjectFilteringWebSocketSessionDecorator.class);
    }

    @Test
    void decorate_tokenWithoutIdentity_sessionRelayedUnfiltered() {
        // setup
        when(natsClientContextFactory.create(exchange, NATS_PATH, TENANT, CONTEXT))
                .thenThrow(new IllegalStateException("no sub"));

        // execution
        WebSocketSession decorated = natsSubjectFilter.decorate(exchange, session, NATS_PATH, TENANT, CONTEXT);

        // verifications
        assertThat(decorated).isSameAs(session);
    }
}
