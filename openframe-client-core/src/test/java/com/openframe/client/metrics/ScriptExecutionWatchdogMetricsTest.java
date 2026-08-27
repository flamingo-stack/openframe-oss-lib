package com.openframe.client.metrics;

import io.micrometer.core.instrument.search.MeterNotFoundException;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScriptExecutionWatchdogMetricsTest {

    private static final String REAPED_COUNTER = "openframe.rmm.execution.watchdog.reaped";
    private static final String DELIVERY_RETRIED_COUNTER = "openframe.rmm.execution.delivery.retried";
    private static final String DELIVERY_FAILED_COUNTER = "openframe.rmm.execution.delivery.failed";

    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
    private final ScriptExecutionWatchdogMetrics metrics = new ScriptExecutionWatchdogMetrics(registry);

    @Test
    void recordScriptReapedIncrementsKindScriptCounter() {
        metrics.recordScriptReaped(3);
        metrics.recordScriptReaped(2);

        assertThat(registry.get(REAPED_COUNTER).tag("kind", "script").counter().count()).isEqualTo(5.0);
    }

    @Test
    void recordScriptReapedIsNoOpForNonPositiveCount() {
        metrics.recordScriptReaped(0);
        metrics.recordScriptReaped(-1);

        // Nothing was recorded, so the counter was never even registered.
        assertThatThrownBy(() -> registry.get(REAPED_COUNTER).counter())
                .isInstanceOf(MeterNotFoundException.class);
    }

    @Test
    void recordDeliveryRetriedIncrementsKindScriptCounter() {
        metrics.recordDeliveryRetried(1);
        metrics.recordDeliveryRetried(2);

        assertThat(registry.get(DELIVERY_RETRIED_COUNTER).tag("kind", "script").counter().count()).isEqualTo(3.0);
    }

    @Test
    void recordDeliveryFailedIncrementsKindScriptCounter() {
        metrics.recordDeliveryFailed(4);

        assertThat(registry.get(DELIVERY_FAILED_COUNTER).tag("kind", "script").counter().count()).isEqualTo(4.0);
    }

    @Test
    void deliveryCountersAreNoOpForNonPositiveCount() {
        metrics.recordDeliveryRetried(0);
        metrics.recordDeliveryFailed(-1);

        assertThatThrownBy(() -> registry.get(DELIVERY_RETRIED_COUNTER).counter()).isInstanceOf(MeterNotFoundException.class);
        assertThatThrownBy(() -> registry.get(DELIVERY_FAILED_COUNTER).counter()).isInstanceOf(MeterNotFoundException.class);
    }
}
