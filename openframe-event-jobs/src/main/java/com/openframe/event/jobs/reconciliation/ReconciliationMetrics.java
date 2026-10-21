package com.openframe.event.jobs.reconciliation;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

// Per copy: a gauge of its last finished run's mismatches, set only from event_jobs on every tick, and a FAILED-runs counter.
public class ReconciliationMetrics {

    private static final String MISMATCHES_GAUGE = "openframe.events.reconciliation.mismatches";
    private static final String FAILED_COUNTER = "openframe.events.reconciliation.failed";
    private static final String TAG_COPY = "copy";

    private final Map<String, AtomicLong> mismatchesByCopy;
    private final Map<String, Counter> failedByCopy;

    // Two copies with one name fail here, at startup; every meter starts at zero, so increase() sees the first change.
    public ReconciliationMetrics(MeterRegistry meterRegistry, List<MappedCopy> copies) {
        Map<String, AtomicLong> mismatches = new HashMap<>();
        Map<String, Counter> failed = new HashMap<>();
        for (MappedCopy copy : copies) {
            String name = copy.getName();
            AtomicLong value = new AtomicLong();
            if (mismatches.putIfAbsent(name, value) != null) {
                throw new IllegalStateException("Two reconciled copies are named " + name);
            }
            Gauge.builder(MISMATCHES_GAUGE, value, AtomicLong::get).tag(TAG_COPY, name).register(meterRegistry);
            Counter counter = meterRegistry.counter(FAILED_COUNTER, TAG_COPY, name);
            failed.put(name, counter);
        }
        this.mismatchesByCopy = Map.copyOf(mismatches);
        this.failedByCopy = Map.copyOf(failed);
    }

    void report(MappedCopy copy, long lastMismatches) {
        String name = copy.getName();
        AtomicLong value = mismatchesByCopy.get(name);
        value.set(lastMismatches);
    }

    void recordFailed(MappedCopy copy) {
        String name = copy.getName();
        Counter counter = failedByCopy.get(name);
        counter.increment();
    }
}
