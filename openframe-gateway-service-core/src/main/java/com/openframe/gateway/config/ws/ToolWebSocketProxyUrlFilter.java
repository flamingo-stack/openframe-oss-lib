package com.openframe.gateway.config.ws;

import com.openframe.core.service.ProxyUrlResolver;
import com.openframe.data.document.apikey.APIKeyType;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.document.tool.ToolUrl;
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

        return getTool(toolId)
                .flatMap(tool -> {
                    ToolUrl toolUrl = toolUrlService.getUrlByToolType(tool, ToolUrlType.WS)
                            .orElseThrow(() -> new IllegalArgumentException("Tool " + tool.getName() + " have no web socket url"));

                    String endpointPrefix = getEndpointPrefix();
                    URI proxyUri = proxyUrlResolver.resolve(toolId, toolUrl.getUrl(), toolUrl.getPort(), requestUri, endpointPrefix);

                    log.info("Proxy web socket request: {}", proxyUri);

                    exchange.getAttributes()
                            .put(ServerWebExchangeUtils.GATEWAY_REQUEST_URL_ATTR, proxyUri);

                    ServerWebExchange mutatedExchange = addApiKeyHeaders(exchange, tool);
                    return chain.filter(mutatedExchange);
                });
    }

    private ServerWebExchange addApiKeyHeaders(ServerWebExchange exchange, IntegratedTool tool) {
        ToolCredentials credentials = tool.getCredentials();
        APIKeyType apiKeyType = credentials != null && credentials.getApiKey() != null
                ? credentials.getApiKey().getType()
                : APIKeyType.NONE;

        return switch (apiKeyType) {
            case HEADER -> {
                String keyName = credentials.getApiKey().getKeyName();
                String key = credentials.getApiKey().getKey();
                log.debug("Adding API key header '{}' for tool: {}", keyName, tool.getId());
                yield exchange.mutate()
                        .request(r -> r.header(keyName, key))
                        .build();
            }
            case BEARER_TOKEN -> {
                String token = credentials.getApiKey().getKey();
                log.debug("Adding Bearer token header for tool: {}", tool.getId());
                yield exchange.mutate()
                        .request(r -> r.header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                        .build();
            }
            case NONE -> exchange;
        };
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
