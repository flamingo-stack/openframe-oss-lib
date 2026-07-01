package com.openframe.gateway.metrics;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GatewayTrafficMetricsTest {

    @Test
    void lifetimeBucketBoundaries() {
        assertThat(GatewayTrafficMetrics.lifetimeBucket(-1)).isEqualTo("unknown");
        assertThat(GatewayTrafficMetrics.lifetimeBucket(0)).isEqualTo("0s");     // the flap bucket
        assertThat(GatewayTrafficMetrics.lifetimeBucket(59)).isEqualTo("<1m");
        assertThat(GatewayTrafficMetrics.lifetimeBucket(60)).isEqualTo("<10m");
        assertThat(GatewayTrafficMetrics.lifetimeBucket(599)).isEqualTo("<10m");
        assertThat(GatewayTrafficMetrics.lifetimeBucket(3599)).isEqualTo("<1h");
        assertThat(GatewayTrafficMetrics.lifetimeBucket(3600)).isEqualTo(">=1h");
    }

    @Test
    void recordSessionClosedIncrementsTaggedCounter() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        GatewayTrafficMetrics metrics = new GatewayTrafficMetrics(registry);

        metrics.recordSessionClosed("meshcentral-server", 1002, 0);
        metrics.recordSessionClosed("meshcentral-server", 1002, 0);

        double count = registry.get("openframe.tenant.gateway.websocket.sessions.closed")
                .tag("tool", "meshcentral-server")
                .tag("code", "1002")
                .tag("lifetime", "0s")
                .counter().count();
        assertThat(count).isEqualTo(2.0);
    }
}
