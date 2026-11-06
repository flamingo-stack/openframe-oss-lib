package com.openframe.event.jobs.task.service;

import com.openframe.publishing.api.spec.Projection;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

// Per projection: gauges of its RUNNING tasks and the oldest one's age, set from event_projection_tasks on every tick, and a FAILED counter.
public class ProjectionTaskMetrics {

    private static final String OPEN_GAUGE = "openframe.events.projection.tasks.open";
    private static final String OLDEST_AGE_GAUGE = "openframe.events.projection.tasks.oldest.age";
    private static final String FAILED_COUNTER = "openframe.events.projection.tasks.failed";
    private static final String TAG_PROJECTION = "projection";
    private static final String SECONDS = "seconds";

    private final Map<String, AtomicLong> openByProjection;
    private final Map<String, AtomicLong> oldestAgeByProjection;
    private final Map<String, Counter> failedByProjection;

    // Every meter starts at zero, so increase() sees the first change.
    public ProjectionTaskMetrics(MeterRegistry meterRegistry, List<Projection<?, ?>> projections) {
        Map<String, AtomicLong> open = new HashMap<>();
        Map<String, AtomicLong> oldestAge = new HashMap<>();
        Map<String, Counter> failed = new HashMap<>();
        for (Projection<?, ?> projection : projections) {
            String name = projection.name();
            AtomicLong openValue = new AtomicLong();
            open.put(name, openValue);
            Gauge.builder(OPEN_GAUGE, openValue, AtomicLong::get).tag(TAG_PROJECTION, name).register(meterRegistry);
            AtomicLong oldestAgeValue = new AtomicLong();
            oldestAge.put(name, oldestAgeValue);
            Gauge.builder(OLDEST_AGE_GAUGE, oldestAgeValue, AtomicLong::get).baseUnit(SECONDS).tag(TAG_PROJECTION, name)
                    .register(meterRegistry);
            Counter counter = meterRegistry.counter(FAILED_COUNTER, TAG_PROJECTION, name);
            failed.put(name, counter);
        }
        this.openByProjection = Map.copyOf(open);
        this.oldestAgeByProjection = Map.copyOf(oldestAge);
        this.failedByProjection = Map.copyOf(failed);
    }

    void report(String projection, long open, Duration oldestAge) {
        openByProjection.get(projection).set(open);
        long oldestAgeSeconds = oldestAge.toSeconds();
        oldestAgeByProjection.get(projection).set(oldestAgeSeconds);
    }

    void recordFailed(String projection) {
        Counter counter = failedByProjection.get(projection);
        counter.increment();
    }
}
