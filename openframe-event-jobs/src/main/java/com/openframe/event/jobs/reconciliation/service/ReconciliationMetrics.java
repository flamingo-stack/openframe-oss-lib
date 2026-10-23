package com.openframe.event.jobs.reconciliation.service;

import com.openframe.publishing.api.spec.Projection;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

// Per projection: a gauge of its last finished run's mismatches, set only from event_jobs on every tick, and a FAILED-runs counter.
public class ReconciliationMetrics {

    private static final String MISMATCHES_GAUGE = "openframe.events.reconciliation.mismatches";
    private static final String FAILED_COUNTER = "openframe.events.reconciliation.failed";
    private static final String TAG_PROJECTION = "projection";

    private final Map<String, AtomicLong> mismatchesByProjection;
    private final Map<String, Counter> failedByProjection;

    // Every meter starts at zero, so increase() sees the first change; the registry already refused two projections with one name.
    public ReconciliationMetrics(MeterRegistry meterRegistry, List<Projection<?, ?>> projections) {
        Map<String, AtomicLong> mismatches = new HashMap<>();
        Map<String, Counter> failed = new HashMap<>();
        for (Projection<?, ?> projection : projections) {
            String name = projection.name();
            AtomicLong value = new AtomicLong();
            mismatches.put(name, value);
            Gauge.builder(MISMATCHES_GAUGE, value, AtomicLong::get).tag(TAG_PROJECTION, name).register(meterRegistry);
            Counter counter = meterRegistry.counter(FAILED_COUNTER, TAG_PROJECTION, name);
            failed.put(name, counter);
        }
        this.mismatchesByProjection = Map.copyOf(mismatches);
        this.failedByProjection = Map.copyOf(failed);
    }

    void report(Projection<?, ?> projection, long lastMismatches) {
        String name = projection.name();
        AtomicLong value = mismatchesByProjection.get(name);
        value.set(lastMismatches);
    }

    void recordFailed(Projection<?, ?> projection) {
        String name = projection.name();
        Counter counter = failedByProjection.get(name);
        counter.increment();
    }
}
