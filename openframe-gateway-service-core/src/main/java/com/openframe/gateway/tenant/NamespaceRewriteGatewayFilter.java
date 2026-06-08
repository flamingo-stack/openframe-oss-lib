package com.openframe.gateway.tenant;

import lombok.extern.slf4j.Slf4j;
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
 * Being a {@link GatewayFilter} (not a {@link org.springframework.cloud.gateway.filter.GlobalFilter})
 * it only runs where explicitly attached, so shared-infra routes in fixed namespaces are never
 * touched. It is a no-op when there is no {@code X-Tenant-Ns} header (single-tenant pods). Ordered to
 * run right after {@link RouteToRequestUrlFilter}, which populates {@link #GATEWAY_REQUEST_URL_ATTR}.
 */
@Slf4j
@Component
public class NamespaceRewriteGatewayFilter implements GatewayFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String ns = GatewayTenantNamespace.tenantNamespace(exchange.getRequest());
        URI requestUrl = exchange.getAttribute(GATEWAY_REQUEST_URL_ATTR);
        if (ns != null && requestUrl != null) {
            URI rewritten = GatewayTenantNamespace.applyToUri(requestUrl, ns);
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
