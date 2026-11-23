package com.openframe.gateway.config.ws;

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
import tools.jackson.databind.ObjectMapper;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NatsSubjectFilterTest {

    private static final String MACHINE_ID = "m-1";
    private static final String USER_ID = "u-1";
    private static final String NATS_PATH = "/ws/nats";
    private static final String TOOL_PATH = "/ws/tools/meshcentral-server/control.ashx";
    private static final String TENANT = "tenant-1";

    @Mock private RequestJwtClaimsReader requestJwtClaimsReader;
    @Mock private GatewayTrafficMetrics gatewayTrafficMetrics;
    @Mock private ServerWebExchange exchange;
    @Mock private WebSocketSession session;

    private NatsSubjectFilterProperties properties;
    private NatsSubjectFilter natsSubjectFilter;

    @BeforeEach
    void setUp() {
        properties = new NatsSubjectFilterProperties();
        properties.setEnabled(true);
        natsSubjectFilter = new NatsSubjectFilter(properties, requestJwtClaimsReader, new ObjectMapper(),
                gatewayTrafficMetrics);
    }

    @ParameterizedTest
    @ValueSource(strings = {"/ws/nats", "/ws/nats-api"})
    void isEnabledFor_natsPathWhileEnabled_true(String path) {
        // execution
        boolean enabled = natsSubjectFilter.isEnabledFor(path);

        // verifications
        assertThat(enabled).isTrue();
    }

    @Test
    void isEnabledFor_toolPath_false() {
        // execution
        boolean enabled = natsSubjectFilter.isEnabledFor(TOOL_PATH);

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
    void decorate_deviceToken_filteringDecoratorForTheMachine() {
        // setup
        when(requestJwtClaimsReader.getMachineId(exchange)).thenReturn(Optional.of(MACHINE_ID));

        // execution
        WebSocketSession decorated = natsSubjectFilter.decorate(exchange, session, NATS_PATH, TENANT);

        // verifications
        assertThat(decorated).isInstanceOf(NatsSubjectFilteringWebSocketSessionDecorator.class);
        verify(requestJwtClaimsReader, never()).getUserId(exchange);
    }

    @Test
    void decorate_userToken_filteringDecoratorForTheUser() {
        // setup
        when(requestJwtClaimsReader.getMachineId(exchange)).thenReturn(Optional.empty());
        when(requestJwtClaimsReader.getUserId(exchange)).thenReturn(USER_ID);

        // execution
        WebSocketSession decorated = natsSubjectFilter.decorate(exchange, session, NATS_PATH, TENANT);

        // verifications
        assertThat(decorated).isInstanceOf(NatsSubjectFilteringWebSocketSessionDecorator.class);
        verify(requestJwtClaimsReader).getUserId(exchange);
    }
}
