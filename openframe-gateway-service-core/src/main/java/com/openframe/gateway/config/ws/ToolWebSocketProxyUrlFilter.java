package com.openframe.gateway.config.ws;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.reactive.repository.tool.ReactiveIntegratedToolRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.gateway.tenant.TenantRoutingHeaders;
import com.openframe.gateway.upstream.ToolUpstreamResolverRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.RouteToRequestUrlFilter;
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.URI;

@RequiredArgsConstructor
@Slf4j
public abstract class ToolWebSocketProxyUrlFilter implements GatewayFilter, Ordered {

    public static final String ORIGINAL_AUTHORIZATION_ATTR = "originalAuthorization";

    private final ReactiveIntegratedToolRepository toolRepository;
    private final ToolUpstreamResolverRegistry upstreamRegistry;

    /**
     * Shared multi-tenant routing mode. When true, a tool lookup with no resolved tenant must NOT
     * fall back to an unscoped query. Defaults false so single-tenant / OSS pods keep prior behavior.
     */
    @Value("${openframe.gateway.tenant-routing.enabled:false}")
    private boolean tenantRoutingEnabled;

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

        return getTool(toolId, request)
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

    /**
     * Load the tool. In multi-tenant mode ({@code openframe.gateway.tenant-routing.enabled=true}) the
     * trusted {@code X-Tenant-Id} header is guaranteed non-blank by the upstream tenant-context
     * enforcement, so the lookup is tenant-scoped with no presence checks. In single-tenant mode
     * headers are never read; the unscoped {@code findByKey} is correct (one tenant only).
     */
    private Mono<IntegratedTool> getTool(String toolId, ServerHttpRequest request) {
        Mono<IntegratedTool> lookup = tenantRoutingEnabled
                ? toolRepository.findByTenantIdAndKey(TenantRoutingHeaders.tenantId(request), toolId)
                : toolRepository.findByKey(toolId);
        return lookup
                // TODO: throw a custom exception (openframe-exception) instead and catch it on the client side
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Tool not found: " + toolId)))
                .flatMap(tool -> {
                    if (!tool.isEnabled()) {
                        // TODO: throw a custom exception (openframe-exception) instead and catch it on the client side
                        return Mono.error(new IllegalArgumentException("Tool " + tool.getName() + " is not enabled"));
                    }
                    return Mono.just(tool);
                });
    }

    protected abstract String getRequestToolId(String path);

    protected abstract String getEndpointPrefix();

}
