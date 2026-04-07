package com.openframe.gateway.config.ws;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.reactive.repository.tool.ReactiveIntegratedToolRepository;
import com.openframe.gateway.upstream.ToolUpstreamResolverRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.RouteToRequestUrlFilter;
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.URI;

@RequiredArgsConstructor
@Slf4j
public abstract class ToolWebSocketProxyUrlFilter implements GatewayFilter, Ordered {

    public static final String ORIGINAL_AUTHORIZATION_ATTR = "originalAuthorization";

    private final ReactiveIntegratedToolRepository toolRepository;
    private final ToolUpstreamResolverRegistry upstreamRegistry;

    @Override
    public int getOrder() {
        return RouteToRequestUrlFilter.ROUTE_TO_URL_FILTER_ORDER + 1;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        URI requestUri = request.getURI();
        String path = requestUri.getPath();

        String toolId = getRequestToolId(path);

        return getTool(toolId)
                .flatMap(tool -> {
                    URI proxyUri = upstreamRegistry.resolve(toolId)
                            .resolveWs(tool, request, getEndpointPrefix());

                    log.debug("Proxy web socket request: {}", proxyUri);

                    exchange.getAttributes()
                            .put(ServerWebExchangeUtils.GATEWAY_REQUEST_URL_ATTR, proxyUri);

                    String originalAuthorization = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
                    if (originalAuthorization != null) {
                        exchange.getAttributes().put(ORIGINAL_AUTHORIZATION_ATTR, originalAuthorization);
                    }

                    ServerWebExchange mutatedExchange = mutateExchange(exchange, tool);
                    return chain.filter(mutatedExchange);
                });
    }

    protected ServerWebExchange mutateExchange(ServerWebExchange exchange, IntegratedTool tool) {
        return exchange;
    }

    private Mono<IntegratedTool> getTool(String toolId) {
        return toolRepository.findById(toolId)
                .switchIfEmpty(Mono.error(new IllegalArgumentException("Tool not found: " + toolId)))
                .flatMap(tool -> {
                    if (!tool.isEnabled()) {
                        return Mono.error(new IllegalArgumentException("Tool " + tool.getName() + " is not enabled"));
                    }
                    return Mono.just(tool);
                });
    }

    protected abstract String getRequestToolId(String path);

    protected abstract String getEndpointPrefix();

}
