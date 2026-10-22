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
import java.util.Map;

import static com.openframe.core.constants.HttpHeaders.X_OPENFRAME_CLIENT;
import static com.openframe.core.clientversion.ClientIdentity.UNKNOWN_VERSION;
import static org.apache.commons.lang3.StringUtils.isBlank;
import static org.springframework.http.HttpHeaders.ORIGIN;

/**
 * Records which client builds ({@code X-OpenFrame-Client}) the users talk to the gateway with, for the
 * rollout dashboard: a request counter by kind/shell/bundle, and a "Client seen" log line once per user and
 * client build per day, which Loki turns into distinct users per version. Runs before
 * {@link ClientUpgradeGateFilter} and regardless of its policy flag, so clients it rejects are counted too.
 * <p>
 * Requests without the header are counted as well, since they decide when {@code enforce-missing-header} can
 * be turned on. The native shells' WebView origin tells an old shell build from everything else: those get a
 * {@code legacy-*} kind and a "Client seen" line, the rest (web, agents, scripts) only {@code none} in the counter.
 */
@Slf4j
@Component
public class ClientVersionMetricsFilter implements GlobalFilter, Ordered {

    private static final int ORDER = -210;
    private static final Duration SEEN_TTL = Duration.ofHours(24);
    private static final long SEEN_MAX_SIZE = 100_000;
    private static final String NO_TENANT = "-";
    private static final String NO_HEADER_KIND = "none";
    private static final Map<String, String> LEGACY_SHELL_KINDS_BY_ORIGIN = Map.of(
            "capacitor://localhost", "legacy-ios",
            "https://localhost", "legacy-android",
            "tauri://localhost", "legacy-desktop");

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
        ServerHttpRequest request = exchange.getRequest();
        return authenticatedSub()
                .doOnNext(sub -> record(request, sub))
                .then(Mono.defer(() -> chain.filter(exchange)));
    }

    private void record(ServerHttpRequest request, String sub) {
        String header = request.getHeaders().getFirst(X_OPENFRAME_CLIENT);
        if (!isBlank(header)) {
            ClientIdentity identity = ClientIdentityParser.parse(header);
            record(request, sub, identity.getKind().getLabel(), identity.getShellVersion(), identity.getBundleVersion());
            return;
        }
        String origin = request.getHeaders().getFirst(ORIGIN);
        String legacyShellKind = origin == null ? null : LEGACY_SHELL_KINDS_BY_ORIGIN.get(origin);
        if (legacyShellKind != null) {
            record(request, sub, legacyShellKind, UNKNOWN_VERSION, UNKNOWN_VERSION);
            return;
        }
        metrics.recordClientRequest(NO_HEADER_KIND, UNKNOWN_VERSION, UNKNOWN_VERSION);
    }

    private void record(ServerHttpRequest request, String sub, String kind, String shellVersion, String bundleVersion) {
        metrics.recordClientRequest(kind, shellVersion, bundleVersion);

        String tenantId = TenantRoutingHeaders.tenantId(request);
        String tenant = isBlank(tenantId) ? NO_TENANT : tenantId;
        String key = tenant + "|" + sub + "|" + kind + "|" + shellVersion + "|" + bundleVersion;
        if (seenClients.asMap().putIfAbsent(key, Boolean.TRUE) == null) {
            log.info("Client seen: tenantId={} sub={} kind={} shell={} bundle={}",
                    tenant, sub, kind, shellVersion, bundleVersion);
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
