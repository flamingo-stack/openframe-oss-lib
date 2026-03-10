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

    @Getter
    private final AtomicInteger activeWebSocketConnections = new AtomicInteger(0);

    public GatewayTrafficMetrics(MeterRegistry registry) {
        Gauge.builder("openframe.tenant.gateway.websocket.connections.active", activeWebSocketConnections, AtomicInteger::get)
                .description("Number of active websocket connections on the gateway")
                .register(registry);
    }

    public void webSocketOpened(String sessionId, String path, String sub) {
        int count = activeWebSocketConnections.incrementAndGet();
        log.info(LOG_PREFIX + "WebSocket opened, active={}", sessionId, path, sub, count);
    }

    public void webSocketClosed(String sessionId, String path, String sub) {
        int count = activeWebSocketConnections.updateAndGet(v -> v > 0 ? v - 1 : 0);
        log.info(LOG_PREFIX + "WebSocket closed, active={}", sessionId, path, sub, count);
    }

}
