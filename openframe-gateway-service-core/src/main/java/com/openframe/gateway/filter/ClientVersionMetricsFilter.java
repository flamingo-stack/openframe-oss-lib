package com.openframe.gateway.filter;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.openframe.core.clientversion.ClientIdentity;
import com.openframe.core.clientversion.ClientIdentityParser;
import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import com.openframe.gateway.tenant.TenantRoutingHeaders;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.time.Duration;

import static com.openframe.core.constants.HttpHeaders.X_OPENFRAME_CLIENT;
import static org.apache.commons.lang3.StringUtils.isBlank;

/**
 * Records which client builds ({@code X-OpenFrame-Client}) the users talk to the gateway with, for the
 * rollout dashboard: a request counter by kind/shell/bundle, and a "Client seen" log line once per user and
 * client build per day, which Loki turns into distinct users per version. Runs before
 * {@link ClientUpgradeGateFilter} and regardless of its policy flag, so clients it rejects are counted too.
 */
@Slf4j
@Component
public class ClientVersionMetricsFilter implements GlobalFilter, Ordered {

    private static final int ORDER = -210;
    private static final Duration SEEN_TTL = Duration.ofHours(24);
    private static final long SEEN_MAX_SIZE = 100_000;
    private static final String NO_TENANT = "-";

    private final GatewayTrafficMetrics metrics;
    private final Cache<String, Boolean> seenClients;

    public ClientVersionMetricsFilter(GatewayTrafficMetrics metrics) {
        this.metrics = metrics;
        this.seenClients = Caffeine.newBuilder()
                .expireAfterWrite(SEEN_TTL)
                .maximumSize(SEEN_MAX_SIZE)
                .build();
    }

    @Override
    public int getOrder() {
        return ORDER;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String header = exchange.getRequest().getHeaders().getFirst(X_OPENFRAME_CLIENT);
        if (isBlank(header)) {
            return chain.filter(exchange);
        }
        return authenticatedSub()
                .doOnNext(sub -> record(exchange.getRequest(), ClientIdentityParser.parse(header), sub))
                .then(Mono.defer(() -> chain.filter(exchange)));
    }

    private void record(ServerHttpRequest request, ClientIdentity identity, String sub) {
        String kind = identity.getKind().getLabel();
        metrics.recordClientRequest(kind, identity.getShellVersion(), identity.getBundleVersion());

        String tenantId = TenantRoutingHeaders.tenantId(request);
        String tenant = isBlank(tenantId) ? NO_TENANT : tenantId;
        String key = tenant + "|" + sub + "|" + kind + "|" + identity.getShellVersion() + "|" + identity.getBundleVersion();
        if (seenClients.asMap().putIfAbsent(key, Boolean.TRUE) == null) {
            log.info("Client seen: tenantId={} sub={} kind={} shell={} bundle={}",
                    tenant, sub, kind, identity.getShellVersion(), identity.getBundleVersion());
        }
    }

    private static Mono<String> authenticatedSub() {
        return ReactiveSecurityContextHolder.getContext()
                .mapNotNull(SecurityContext::getAuthentication)
                .filter(Authentication::isAuthenticated)
                .map(Authentication::getName)
                .onErrorResume(e -> Mono.empty());
    }
}
