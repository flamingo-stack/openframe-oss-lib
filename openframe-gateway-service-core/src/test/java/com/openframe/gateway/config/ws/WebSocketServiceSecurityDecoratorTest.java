package com.openframe.gateway.config.ws;

import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.RequestPath;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.web.reactive.socket.CloseStatus;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketSession;
import org.springframework.web.reactive.socket.server.WebSocketService;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Guards the fix for the path-scoping bug: frame logging must be decided on the ORIGINAL gateway
 * request path (available here), not the rewritten upstream URL the {@code WebSocketClient} sees.
 */
class WebSocketServiceSecurityDecoratorTest {

    private static final String MESH_REQUEST_PATH = "/ws/tools/agent/meshcentral-server/agent.ashx";

    @Test
    void wrapsClientSessionForFrameLogging_whenRequestPathMatchesFramePrefix() {
        WebSocketLoggingProperties props = new WebSocketLoggingProperties();
        props.setFramePayloadLoggingEnabled(true);
        props.setFramePathPrefixes(List.of("/ws/tools/agent/meshcentral-server/"));

        WebSocketSession proxied = handleAndCaptureProxiedSession(props, MESH_REQUEST_PATH);

        // The proxy relay must receive the TAPPED client session — proving the wrap decision is made
        // on the request path. (Before the fix it was checked against the upstream URL and never matched.)
        assertThat(proxied).isInstanceOf(LoggingWebSocketSessionDecorator.class);
    }

    @Test
    void doesNotWrapClientSession_whenRequestPathDoesNotMatchFramePrefix() {
        WebSocketLoggingProperties props = new WebSocketLoggingProperties();
        props.setFramePayloadLoggingEnabled(true);
        props.setFramePathPrefixes(List.of("/ws/tools/agent/tactical-rmm/"));

        WebSocketSession proxied = handleAndCaptureProxiedSession(props, MESH_REQUEST_PATH);

        assertThat(proxied).isNotInstanceOf(LoggingWebSocketSessionDecorator.class);
    }

    @Test
    void toolFromPath_extractsLowCardinalityToolLabel() {
        assertThat(WebSocketServiceSecurityDecorator.toolFromPath("/ws/tools/agent/meshcentral-server/agent.ashx")).isEqualTo("meshcentral-server");
        assertThat(WebSocketServiceSecurityDecorator.toolFromPath("/ws/tools/agent/tactical-rmm/natsws")).isEqualTo("tactical-rmm");
        assertThat(WebSocketServiceSecurityDecorator.toolFromPath("/ws/tools/meshcentral-server/meshrelay.ashx")).isEqualTo("meshcentral-server");
        assertThat(WebSocketServiceSecurityDecorator.toolFromPath("/ws/nats-api")).isEqualTo("nats-api");
        assertThat(WebSocketServiceSecurityDecorator.toolFromPath("/ws/nats")).isEqualTo("nats");
        assertThat(WebSocketServiceSecurityDecorator.toolFromPath("/ws/other")).isEqualTo("other");
    }

    private WebSocketSession handleAndCaptureProxiedSession(WebSocketLoggingProperties props, String requestPath) {
        WebSocketService defaultService = mock(WebSocketService.class);
        RequestJwtClaimsReader jwtReader = mock(RequestJwtClaimsReader.class);
        GatewayTrafficMetrics metrics = mock(GatewayTrafficMetrics.class);

        WebSocketServiceSecurityDecorator decorator =
                new WebSocketServiceSecurityDecorator(defaultService, jwtReader, metrics, props);

        ServerWebExchange exchange = exchangeWithPath(requestPath);
        when(jwtReader.getSubject(exchange)).thenReturn(Optional.of("agent_x"));
        when(jwtReader.getExpiration(exchange)).thenReturn(Instant.now().plusSeconds(3600));

        WebSocketSession clientSession = mock(WebSocketSession.class);
        when(clientSession.getId()).thenReturn("session-1");
        when(clientSession.closeStatus()).thenReturn(Mono.<CloseStatus>never());

        WebSocketHandler proxyHandler = mock(WebSocketHandler.class);
        ArgumentCaptor<WebSocketSession> proxiedSession = ArgumentCaptor.forClass(WebSocketSession.class);
        when(proxyHandler.handle(proxiedSession.capture())).thenReturn(Mono.empty());

        // Make the default WebSocketService invoke the security handler with our client session,
        // mirroring how Spring's reactive stack drives the relay.
        when(defaultService.handleRequest(eq(exchange), any(WebSocketHandler.class)))
                .thenAnswer(invocation -> {
                    WebSocketHandler securityHandler = invocation.getArgument(1);
                    return securityHandler.handle(clientSession);
                });

        decorator.handleRequest(exchange, proxyHandler).block();

        return proxiedSession.getValue();
    }

    private static ServerWebExchange exchangeWithPath(String path) {
        ServerWebExchange exchange = mock(ServerWebExchange.class);
        ServerHttpRequest request = mock(ServerHttpRequest.class);
        RequestPath requestPath = mock(RequestPath.class);
        when(requestPath.value()).thenReturn(path);
        when(request.getPath()).thenReturn(requestPath);
        when(request.getHeaders()).thenReturn(new HttpHeaders());
        when(exchange.getRequest()).thenReturn(request);
        return exchange;
    }
}
