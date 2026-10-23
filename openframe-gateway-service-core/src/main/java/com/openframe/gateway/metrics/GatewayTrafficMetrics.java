package com.openframe.gateway.metrics;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Ticker;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

@Component
@Slf4j
public class GatewayTrafficMetrics {

    private static final String LOG_PREFIX = "sessionId={} path={} sub={} | ";
    private static final String CLOSED_COUNTER = "openframe.tenant.gateway.websocket.sessions.closed";
    private static final String CLIENT_UPGRADE_REQUIRED_COUNTER = "openframe.tenant.gateway.client.upgrade.required";
    private static final String CLIENT_REQUESTS_COUNTER = "openframe.tenant.gateway.client.requests";
    static final String OTHER_VERSION = "other";
    static final int MAX_CLIENT_VERSION_SERIES = 200;
    static final Duration CLIENT_VERSION_SERIES_TTL = Duration.ofDays(7);

    @Getter
    private final AtomicInteger activeWebSocketConnections = new AtomicInteger(0);

    private final MeterRegistry registry;
    private final Cache<String, Counter> clientVersionCounters;

    @Autowired
    public GatewayTrafficMetrics(MeterRegistry registry) {
        this(registry, Ticker.systemTicker());
    }

    GatewayTrafficMetrics(MeterRegistry registry, Ticker ticker) {
        this.registry = registry;
        this.clientVersionCounters = Caffeine.newBuilder()
                .expireAfterAccess(CLIENT_VERSION_SERIES_TTL)
                .ticker(ticker)
                .executor(Runnable::run)
                .<String, Counter>removalListener((series, counter, cause) -> {
                    if (counter != null) {
                        registry.remove(counter);
                    }
                })
                .build();
        Gauge.builder("openframe.tenant.gateway.websocket.connections.active", activeWebSocketConnections, AtomicInteger::get)
                .description("Number of active websocket connections on the gateway")
                .register(registry);
    }

    /**
     * Counts a WebSocket upgrade rejected before authentication (expired / invalid / missing token).
     * Low-cardinality tags only. A sustained rise of {@code reason="expired_token"} means agents are
     * presenting stale JWTs — i.e. agent token rotation is broken — long before machines drop offline.
     */
    public void recordUpgradeRejected(String tool, String reason) {
        registry.counter("openframe.tenant.gateway.websocket.upgrade.rejected",
                "tool", tool,
                "reason", reason).increment();
    }

    public void recordClientUpgradeRequired(String kind) {
        registry.counter(CLIENT_UPGRADE_REQUIRED_COUNTER, "kind", kind).increment();
    }

    /**
     * Counts an authenticated request by the client build in {@code X-OpenFrame-Client}. The versions come
     * from a header any caller can set, so the number of distinct kind/shell/bundle series is capped: once
     * the cap is reached, new combinations are counted under {@code other} versions of their kind. A series
     * not seen for {@link #CLIENT_VERSION_SERIES_TTL} is dropped from the registry and frees its slot, so
     * builds nobody runs any more do not hold the cap on a long-lived pod.
     */
    public void recordClientRequest(String kind, String shellVersion, String bundleVersion) {
        String series = kind + "/" + shellVersion + "/" + bundleVersion;
        Counter counter = clientVersionCounters.getIfPresent(series);
        if (counter == null) {
            counter = hasFreeClientVersionSlot()
                    ? clientVersionCounters.get(series, key -> clientRequestCounter(kind, shellVersion, bundleVersion))
                    : clientRequestCounter(kind, OTHER_VERSION, OTHER_VERSION);
        }
        counter.increment();
    }

    // Expired series leave the cache lazily; at the cap, evict them first so they free their slots now.
    private boolean hasFreeClientVersionSlot() {
        if (clientVersionCounters.estimatedSize() < MAX_CLIENT_VERSION_SERIES) {
            return true;
        }
        clientVersionCounters.cleanUp();
        return clientVersionCounters.estimatedSize() < MAX_CLIENT_VERSION_SERIES;
    }

    private Counter clientRequestCounter(String kind, String shellVersion, String bundleVersion) {
        return registry.counter(CLIENT_REQUESTS_COUNTER,
                "kind", kind,
                "shell", shellVersion,
                "bundle", bundleVersion);
    }

    public void webSocketOpened(String sessionId, String path, String sub) {
        int count = activeWebSocketConnections.incrementAndGet();
        log.debug(LOG_PREFIX + "WebSocket opened, active={}", sessionId, path, sub, count);
    }

    public void webSocketClosed(String sessionId, String path, String sub) {
        int count = activeWebSocketConnections.updateAndGet(v -> v > 0 ? v - 1 : 0);
        log.debug(LOG_PREFIX + "WebSocket closed, active={}", sessionId, path, sub, count);
    }

    /**
     * Counts a closed WebSocket session, tagged by tool, WS close code and a coarse lifetime bucket.
     * Tags are intentionally low-cardinality (no tenant/sub) so this is safe as a time-series metric on
     * the shared multi-tenant gateway — it surfaces trends like "0s meshcentral flaps rising"; per-tenant
     * / per-agent drill-down stays in the logs (which carry tenant + sub).
     */
    public void recordSessionClosed(String tool, int closeCode, long lifetimeSeconds) {
        registry.counter(CLOSED_COUNTER,
                "tool", tool,
                "code", String.valueOf(closeCode),
                "lifetime", lifetimeBucket(lifetimeSeconds)).increment();
    }

    static String lifetimeBucket(long seconds) {
        if (seconds < 0) {
            return "unknown";
        }
        if (seconds == 0) {
            return "0s";
        }
        if (seconds < 60) {
            return "<1m";
        }
        if (seconds < 600) {
            return "<10m";
        }
        if (seconds < 3600) {
            return "<1h";
        }
        return ">=1h";
    }

}
