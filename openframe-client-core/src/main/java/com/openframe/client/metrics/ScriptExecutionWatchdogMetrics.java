package com.openframe.client.metrics;

import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

@Component
public class ScriptExecutionWatchdogMetrics {

    private static final String REAPED_COUNTER = "openframe.rmm.execution.watchdog.reaped";
    private static final String TAG_KIND = "kind";
    private static final String KIND_SCRIPT = "script";

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
}
