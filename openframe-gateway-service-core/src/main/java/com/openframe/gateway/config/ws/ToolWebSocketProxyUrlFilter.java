package com.openframe.gateway.config.ws;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
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
import org.springframework.http.HttpStatusCode;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.time.Duration;

@RequiredArgsConstructor
@Slf4j
public abstract class ToolWebSocketProxyUrlFilter implements GatewayFilter, Ordered {

    public static final String ORIGINAL_AUTHORIZATION_ATTR = "originalAuthorization";

    // Bounds the per-upgrade tool lookup so a stalled Mongo query fails fast instead of letting the WS upgrade hang to the gateway response-timeout.
    private static final Duration LOOKUP_TIMEOUT = Duration.ofSeconds(5);

    private final ReactiveIntegratedToolRepository toolRepository;
    private final ToolUpstreamResolverRegistry upstreamRegistry;

    // Cache resolved tools briefly so an agent reconnect storm doesn't put a Mongo lookup on every WS upgrade (configs change rarely).
    private final Cache<String, IntegratedTool> toolCache = Caffeine.newBuilder()
            .maximumSize(10_000)
            .expireAfterWrite(Duration.ofSeconds(60))
            .build();

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
                })
                // Without this, a lookup error/timeout left the WS upgrade hanging with no response written, so the agent saw "No HTTP response" and retried forever; fail fast with a real status instead.
                .onErrorResume(ex -> abortUpgrade(exchange, toolId, ex));
    }

    private Mono<Void> abortUpgrade(ServerWebExchange exchange, String toolId, Throwable ex) {
        HttpStatusCode status = (ex instanceof ResponseStatusException rse) ? rse.getStatusCode() : HttpStatus.SERVICE_UNAVAILABLE;
        log.warn("Tool websocket upgrade aborted (tool={}, status={}): {}", toolId, status, ex.toString());
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(status);
        return response.setComplete();
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
        String cacheKey = tenantRoutingEnabled
                ? (TenantRoutingHeaders.tenantId(request) + "::" + toolId)
                : toolId;
        IntegratedTool cached = toolCache.getIfPresent(cacheKey);
        if (cached != null) {
            return Mono.just(cached);
        }

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
                })
                .timeout(LOOKUP_TIMEOUT)
                // Only successful (present + enabled) tools are cached; not-found / not-enabled stay uncached so they recover immediately once fixed.
                .doOnNext(tool -> toolCache.put(cacheKey, tool));
    }

    protected abstract String getRequestToolId(String path);

    protected abstract String getEndpointPrefix();

}
