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

    @Getter
    private final AtomicInteger activeWebSocketConnections = new AtomicInteger(0);

    public GatewayTrafficMetrics(MeterRegistry registry) {
        Gauge.builder("openframe.tenant.gateway.websocket.connections.active", activeWebSocketConnections, AtomicInteger::get)
                .description("Number of active websocket connections on the gateway")
                .register(registry);
    }

    public void webSocketOpened() {
        int count = activeWebSocketConnections.incrementAndGet();
        log.info("WebSocket opened, active={}", count);
    }

    public void webSocketClosed() {
        int count = activeWebSocketConnections.updateAndGet(v -> v > 0 ? v - 1 : 0);
        log.info("WebSocket closed, active={}", count);
    }
}
