package com.openframe.gateway.config.ws;

import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.reactive.socket.server.WebSocketService;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class WebSocketGatewayConfigTest {

    @Mock private RequestJwtClaimsReader requestJwtClaimsReader;
    @Mock private WebSocketService defaultWebSocketService;
    @Mock private GatewayTrafficMetrics gatewayTrafficMetrics;
    @Mock private RelayAccessWatcher relayAccessWatcher;

    private WebSocketGatewayConfig config;

    @BeforeEach
    void setUp() {
        config = new WebSocketGatewayConfig();
    }

    @Test
    void webSocketServiceDecorator_allCollaborators_returnsTheSecurityDecorator() {
        // setup
        WebSocketLoggingProperties loggingProperties = new WebSocketLoggingProperties();
        MeshControlCommandProperties meshControlProperties = new MeshControlCommandProperties();
        RemoteSessionCapProperties sessionCap = new RemoteSessionCapProperties();
        ObjectMapper objectMapper = new ObjectMapper();

        // execution
        WebSocketService service = config.webSocketServiceDecorator(requestJwtClaimsReader, defaultWebSocketService,
                gatewayTrafficMetrics, loggingProperties, meshControlProperties, objectMapper, relayAccessWatcher,
                sessionCap);

        // verifications
        assertThat(service).isInstanceOf(WebSocketServiceSecurityDecorator.class);
    }
}
