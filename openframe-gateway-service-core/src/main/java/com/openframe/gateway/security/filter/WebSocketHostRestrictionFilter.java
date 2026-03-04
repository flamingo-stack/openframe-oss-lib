package com.openframe.gateway.security.filter;

import com.openframe.gateway.config.prop.WebSocketRestrictionProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import static com.openframe.gateway.config.ws.WebSocketGatewayConfig.*;

/**
 * Rejects WebSocket upgrade requests (tools/agent, nats, nats-api)
 * when the Host header matches one of the restricted hosts.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
@RequiredArgsConstructor
@Slf4j
public class WebSocketHostRestrictionFilter implements WebFilter {

    private final WebSocketRestrictionProperties properties;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        if (!properties.isEnabled()) {
            return chain.filter(exchange);
        }

        ServerHttpRequest request = exchange.getRequest();
        String path = request.getPath().value();

        if (!isRestrictedWebSocketPath(path)) {
            return chain.filter(exchange);
        }

        String host = stripPort(request.getHeaders().getFirst("Host"));
        if (host != null && properties.getRestrictedHosts().contains(host)) {
            log.warn("Rejected WebSocket request to {} from restricted host {}", path, host);
            exchange.getResponse().setStatusCode(HttpStatus.FORBIDDEN);
            return exchange.getResponse().setComplete();
        }

        return chain.filter(exchange);
    }

    private boolean isRestrictedWebSocketPath(String path) {
        return path.startsWith(TOOLS_AGENT_WS_ENDPOINT_PREFIX)
                || path.startsWith(TOOLS_API_WS_ENDPOINT_PREFIX)
                || path.startsWith(NATS_WS_ENDPOINT_PATH)
                || path.startsWith(NATS_API_WS_ENDPOINT_PATH);
    }

    private static String stripPort(String host) {
        if (host == null) {
            return null;
        }
        int colonIdx = host.indexOf(':');
        return colonIdx > 0 ? host.substring(0, colonIdx) : host;
    }
}
