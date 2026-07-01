package com.openframe.gateway.metrics;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicInteger;

@Component
@Slf4j
public class GatewayTrafficMetrics {

    private static final String LOG_PREFIX = "sessionId={} path={} sub={} | ";
    private static final String CLOSED_COUNTER = "openframe.tenant.gateway.websocket.sessions.closed";

    @Getter
    private final AtomicInteger activeWebSocketConnections = new AtomicInteger(0);

    private final MeterRegistry registry;

    public GatewayTrafficMetrics(MeterRegistry registry) {
        this.registry = registry;
        Gauge.builder("openframe.tenant.gateway.websocket.connections.active", activeWebSocketConnections, AtomicInteger::get)
                .description("Number of active websocket connections on the gateway")
                .register(registry);
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
