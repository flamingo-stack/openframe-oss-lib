package com.openframe.gateway.config.ws;

import com.openframe.core.service.ProxyUrlResolver;
import com.openframe.data.document.apikey.APIKeyType;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.document.tool.ToolUrlType;
import com.openframe.data.reactive.repository.tool.ReactiveIntegratedToolRepository;
import com.openframe.data.service.ToolUrlService;
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

    private final ReactiveIntegratedToolRepository toolRepository;
    private final ToolUrlService toolUrlService;
    private final ProxyUrlResolver proxyUrlResolver;

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

        return findTool(toolId)
                .flatMap(tool -> toolUrlService.getUrlByToolType(tool, ToolUrlType.WS)
                        .map(Mono::just)
                        .orElse(Mono.error(new IllegalArgumentException("Tool " + tool.getName() + " have no web socket url")))
                        .flatMap(toolUrl -> {
                            String endpointPrefix = getEndpointPrefix();
                            URI proxyUri = proxyUrlResolver.resolve(toolId, toolUrl.getUrl(), toolUrl.getPort(), requestUri, endpointPrefix);

                            log.info("Proxy web socket request: {}", proxyUri);

                            exchange.getAttributes()
                                    .put(ServerWebExchangeUtils.GATEWAY_REQUEST_URL_ATTR, proxyUri);

                            ServerHttpRequest mutatedRequest = applyToolCredentials(request, tool);
                            return chain.filter(exchange.mutate().request(mutatedRequest).build());
                        }));
    }

    private Mono<IntegratedTool> findTool(String toolId) {
        return toolRepository.findById(toolId)
                .switchIfEmpty(Mono.error(new IllegalArgumentException("Tool not found: " + toolId)))
                .flatMap(tool -> {
                    if (!tool.isEnabled()) {
                        return Mono.error(new IllegalArgumentException("Tool " + tool.getName() + " is not enabled"));
                    }
                    return Mono.just(tool);
                });
    }

    private ServerHttpRequest applyToolCredentials(ServerHttpRequest request, IntegratedTool tool) {
        ToolCredentials credentials = tool.getCredentials();
        if (credentials == null || credentials.getApiKey() == null) {
            return request;
        }

        APIKeyType apiKeyType = credentials.getApiKey().getType();
        if (apiKeyType == null || apiKeyType == APIKeyType.NONE) {
            return request;
        }

        switch (apiKeyType) {
            case BEARER_TOKEN:
                return request.mutate()
                        .headers(h -> h.set(HttpHeaders.AUTHORIZATION, "Bearer " + credentials.getApiKey().getKey()))
                        .build();
            case HEADER:
                return request.mutate()
                        .headers(h -> h.set(credentials.getApiKey().getKeyName(), credentials.getApiKey().getKey()))
                        .build();
            default:
                return request;
        }
    }

    protected abstract String getRequestToolId(String path);

    protected abstract String getEndpointPrefix();

}
