package com.openframe.client.metrics;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

// Tenant ids are never tags: every tenant's client service is its own scrape target.
@Component
@RequiredArgsConstructor
public class DeviceOsUpdateRolloutStateMetrics {

    private static final String RUN_DURATION_TIMER = "openframe.rmm.os_update.rollout.duration";
    private static final String ERRORS_COUNTER = "openframe.rmm.os_update.rollout.errors";
    private static final String TAG_STAGE = "stage";
    private static final String STAGE_RUN = "run";

    private final MeterRegistry meterRegistry;

    public Timer.Sample startRun() {
        return Timer.start(meterRegistry);
    }

    public void recordRun(Timer.Sample runStarted) {
        runStarted.stop(meterRegistry.timer(RUN_DURATION_TIMER));
    }

    public void recordRunFailed() {
        meterRegistry.counter(ERRORS_COUNTER, TAG_STAGE, STAGE_RUN).increment();
    }
}
