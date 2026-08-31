package com.openframe.client.metrics;

import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

@Component
public class ScriptExecutionWatchdogMetrics {

    private static final String REAPED_COUNTER = "openframe.rmm.execution.watchdog.reaped";
    private static final String DELIVERY_RETRIED_COUNTER = "openframe.rmm.execution.delivery.retried";
    private static final String DELIVERY_FAILED_COUNTER = "openframe.rmm.execution.delivery.failed";
    private static final String TAG_KIND = "kind";
    private static final String KIND_SCRIPT = "script";
    private static final String TAG_REASON = "reason";
    private static final String REASON_EXHAUSTED = "exhausted";
    private static final String REASON_OFFLINE = "offline";

    private final MeterRegistry meterRegistry;

    public ScriptExecutionWatchdogMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    /**
     * Records that the watchdog force-failed {@code count} stuck script executions
     * (RUNNING rows whose per-execution threshold elapsed with no terminal result).
     */
    public void recordScriptReaped(long count) {
        if (count <= 0) {
            return;
        }
        meterRegistry.counter(REAPED_COUNTER, TAG_KIND, KIND_SCRIPT).increment(count);
    }

    /** Records {@code count} QUEUED deliveries re-sent to the agent because it hadn't acknowledged them. */
    public void recordDeliveryRetried(long count) {
        if (count <= 0) {
            return;
        }
        meterRegistry.counter(DELIVERY_RETRIED_COUNTER, TAG_KIND, KIND_SCRIPT).increment(count);
    }

    public void recordDeliveryFailedExhausted(long count) {
        recordDeliveryFailed(count, REASON_EXHAUSTED);
    }

    public void recordDeliveryFailedOffline(long count) {
        recordDeliveryFailed(count, REASON_OFFLINE);
    }

    private void recordDeliveryFailed(long count, String reason) {
        if (count <= 0) {
            return;
        }
        meterRegistry.counter(DELIVERY_FAILED_COUNTER, TAG_KIND, KIND_SCRIPT, TAG_REASON, reason).increment(count);
    }
}
