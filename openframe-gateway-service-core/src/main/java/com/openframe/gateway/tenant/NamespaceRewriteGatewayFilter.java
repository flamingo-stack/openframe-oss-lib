package com.openframe.gateway.tenant;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.RouteToRequestUrlFilter;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.URI;

import static org.springframework.cloud.gateway.support.ServerWebExchangeUtils.GATEWAY_REQUEST_URL_ATTR;

/**
 * Route-scoped filter that rewrites a route's resolved target host to the calling tenant's namespace.
 * <p>
 * Use it on routes whose {@code uri(...)} is a static cluster-local address carrying a namespace
 * placeholder (e.g. the NATS websocket routes {@code ws://nats.<placeholder>.svc.cluster.local}).
 * Tool-proxy routes do not need it — their upstream resolvers already namespace per request.
 * <p>
 * Active only in multi-tenant mode ({@code openframe.gateway.tenant-routing.enabled=true}), where the
 * trusted {@code X-Tenant-Ns} header is guaranteed by the upstream tenant-context enforcement. In
 * single-tenant mode headers are never read and the filter is a no-op, so those pods are unaffected.
 * <p>
 * Being a {@link GatewayFilter} (not a {@link org.springframework.cloud.gateway.filter.GlobalFilter})
 * it only runs where explicitly attached, so shared-infra routes in fixed namespaces are never
 * touched. Ordered to run right after {@link RouteToRequestUrlFilter}, which populates
 * {@link #GATEWAY_REQUEST_URL_ATTR}.
 */
@Slf4j
@Component
public class NamespaceRewriteGatewayFilter implements GatewayFilter, Ordered {

    @Value("${openframe.gateway.tenant-routing.enabled:false}")
    private boolean tenantRoutingEnabled;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        URI requestUrl = exchange.getAttribute(GATEWAY_REQUEST_URL_ATTR);
        if (tenantRoutingEnabled && requestUrl != null) {
            String ns = TenantRoutingHeaders.tenantNamespace(exchange.getRequest());
            URI rewritten = TenantRoutingHeaders.applyToUri(requestUrl, ns);
            if (!rewritten.equals(requestUrl)) {
                exchange.getAttributes().put(GATEWAY_REQUEST_URL_ATTR, rewritten);
                log.debug("Tenant namespace routing: {} -> {}", requestUrl, rewritten);
            }
        }
        return chain.filter(exchange);
    }

    @Override
    public int getOrder() {
        return RouteToRequestUrlFilter.ROUTE_TO_URL_FILTER_ORDER + 1;
    }
}
