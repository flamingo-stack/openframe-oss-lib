package com.openframe.gateway.config.ws;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.reactive.socket.client.WebSocketClient;
import org.springframework.web.reactive.socket.server.WebSocketService;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class WebSocketGatewayConfig {

    public static final String TOOLS_AGENT_WS_ENDPOINT_PREFIX = "/ws/tools/agent";
    public static final String TOOLS_API_WS_ENDPOINT_PREFIX = "/ws/tools";
    public static final String NATS_WS_ENDPOINT_PATH = "/ws/nats";
    public static final String NATS_API_WS_ENDPOINT_PATH = "/ws/nats-api";

    @Bean
    public RouteLocator customRouteLocator(
            RouteLocatorBuilder builder,
            ToolApiWebSocketProxyUrlFilter toolApiWebSocketProxyUrlFilter,
            ToolAgentWebSocketProxyUrlFilter toolAgentWebSocketProxyUrlFilter,
            @Value("${nats-ws-url}") String natsWsUrl
    ) {
        return builder.routes()
                .route("agent_gateway_websocket_route", r -> r
                        .path(TOOLS_AGENT_WS_ENDPOINT_PREFIX + "{toolId}/**")
                        .filters(f -> f.filter(toolAgentWebSocketProxyUrlFilter))
                        .uri("no://op"))
                .route("api_gateway_websocket_route", r -> r
                        .path(TOOLS_API_WS_ENDPOINT_PREFIX + "{toolId}/**")
                        .filters(f -> f.filter(toolApiWebSocketProxyUrlFilter))
                        .uri("no://op"))
                .route("nats_websocket_route", r -> r
                        .path(NATS_WS_ENDPOINT_PATH)
                        .uri(natsWsUrl))
                .route("nats_api_websocket_route", r -> r
                        .path(NATS_API_WS_ENDPOINT_PATH)
                        .uri(natsWsUrl))
                .build();
    }

    @Bean
    @Primary
    public WebSocketClient proxyCleanupWebSocketClient(
            @Qualifier("reactorNettyWebSocketClient") WebSocketClient delegate,
            WebSocketLoggingProperties loggingProperties,
            @Value("${openframe.gateway.websocket.proxy-cleanup.enabled:false}") boolean cleanupEnabled) {
        if (cleanupEnabled) {
            log.info("WebSocket proxy session cleanup is ENABLED");
            return new ProxySessionCleanupWebSocketClient(delegate, loggingProperties);
        }
        log.info("WebSocket proxy session cleanup is DISABLED");
        return delegate;
    }

    @Bean
    @Primary
    public WebSocketService webSocketServiceDecorator(
            RequestJwtClaimsReader requestJwtClaimsReader,
            WebSocketService defaultWebSocketService,
            GatewayTrafficMetrics gatewayTrafficMetrics,
            WebSocketLoggingProperties webSocketLoggingProperties
    ) {
        return new WebSocketServiceSecurityDecorator(defaultWebSocketService, requestJwtClaimsReader, gatewayTrafficMetrics, webSocketLoggingProperties);
    }



}
