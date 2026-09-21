package com.openframe.delivery.metrics;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DeliveryMetricsTest {

    private static final String PASS = "retry";
    private static final String SWEEP_TIMER = "openframe.delivery.sweep.duration";

    private SimpleMeterRegistry registry;
    private DeliveryMetrics metrics;

    @BeforeEach
    void setUp() {
        registry = new SimpleMeterRegistry();
        metrics = new DeliveryMetrics(registry);
    }

    @Test
    void timeSweepPass_bodyCompletes_timerTaggedOk() {
        // setup
        Runnable body = () -> { };

        // execution
        metrics.timeSweepPass(PASS, body);

        // verifications
        Timer timer = registry.find(SWEEP_TIMER).tags("pass", PASS, "outcome", "ok").timer();
        assertThat(timer).isNotNull();
        assertThat(timer.count()).isEqualTo(1L);
    }

    @Test
    void timeSweepPass_bodyThrows_timerTaggedErrorAndExceptionRethrown() {
        // setup
        Runnable body = () -> {
            throw new IllegalStateException("boom");
        };

        // execution + verifications
        assertThatThrownBy(() -> metrics.timeSweepPass(PASS, body))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("boom");
        Timer timer = registry.find(SWEEP_TIMER).tags("pass", PASS, "outcome", "error").timer();
        assertThat(timer).isNotNull();
        assertThat(timer.count()).isEqualTo(1L);
    }

    @Test
    void recordFailed_typeAndReason_counterTaggedLowercase() {
        // setup

        // execution
        metrics.recordFailed(DeliveryType.TOOL_INSTALLATION, DeliveryFailure.TIMEOUT);

        // verifications
        Counter counter = registry.find("openframe.delivery.failed").tags("type", "tool_installation", "reason", "timeout").counter();
        assertThat(counter).isNotNull();
        assertThat(counter.count()).isEqualTo(1.0);
    }
}
