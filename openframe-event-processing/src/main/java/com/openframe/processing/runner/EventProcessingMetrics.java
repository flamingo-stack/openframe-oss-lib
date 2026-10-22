package com.openframe.processing.runner;

import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.AllArgsConstructor;

import java.util.List;
import java.util.Map;

import static java.util.function.Function.identity;
import static java.util.stream.Collectors.toUnmodifiableMap;

// One timer per projection and outcome (its count is the number of events); registered once, at startup.
public class EventProcessingMetrics {

    private static final String APPLY_TIMER = "openframe.events.processing.apply";
    private static final String TAG_PROJECTION = "projection";
    private static final String TAG_OUTCOME = "outcome";
    static final String OUTCOME_APPLIED = "applied";
    static final String OUTCOME_HANDED_OVER = "handed_over";
    static final String OUTCOME_SKIPPED = "skipped";
    static final String OUTCOME_DELETED = "deleted";
    static final String OUTCOME_FAILED = "failed";
    static final String OUTCOME_MONGO_UNAVAILABLE = "mongo_unavailable";

    private final MeterRegistry meterRegistry;
    private final Map<String, ProjectionMeters> metersByProjection;

    public EventProcessingMetrics(MeterRegistry meterRegistry, AggregateSpecRegistry specRegistry) {
        this.meterRegistry = meterRegistry;
        List<Projection<?, ?>> projections = specRegistry.projections();
        this.metersByProjection = projections.stream().map(Projection::name)
                .collect(toUnmodifiableMap(identity(), this::metersOf));
    }

    Timer.Sample start() {
        return Timer.start(meterRegistry);
    }

    void recordApplied(Timer.Sample sample, String projectionName) {
        ProjectionMeters meters = metersByProjection.get(projectionName);
        sample.stop(meters.applied);
    }

    void recordHandedOver(Timer.Sample sample, String projectionName) {
        ProjectionMeters meters = metersByProjection.get(projectionName);
        sample.stop(meters.handedOver);
    }

    void recordSkipped(Timer.Sample sample, String projectionName) {
        ProjectionMeters meters = metersByProjection.get(projectionName);
        sample.stop(meters.skipped);
    }

    void recordDeleted(Timer.Sample sample, String projectionName) {
        ProjectionMeters meters = metersByProjection.get(projectionName);
        sample.stop(meters.deleted);
    }

    void recordFailed(Timer.Sample sample, String projectionName) {
        ProjectionMeters meters = metersByProjection.get(projectionName);
        sample.stop(meters.failed);
    }

    void recordMongoUnavailable(Timer.Sample sample, String projectionName) {
        ProjectionMeters meters = metersByProjection.get(projectionName);
        sample.stop(meters.mongoUnavailable);
    }

    private ProjectionMeters metersOf(String projectionName) {
        Timer applied = timerOf(projectionName, OUTCOME_APPLIED);
        Timer handedOver = timerOf(projectionName, OUTCOME_HANDED_OVER);
        Timer skipped = timerOf(projectionName, OUTCOME_SKIPPED);
        Timer deleted = timerOf(projectionName, OUTCOME_DELETED);
        Timer failed = timerOf(projectionName, OUTCOME_FAILED);
        Timer mongoUnavailable = timerOf(projectionName, OUTCOME_MONGO_UNAVAILABLE);
        return new ProjectionMeters(applied, handedOver, skipped, deleted, failed, mongoUnavailable);
    }

    private Timer timerOf(String projectionName, String outcome) {
        return meterRegistry.timer(APPLY_TIMER, TAG_PROJECTION, projectionName, TAG_OUTCOME, outcome);
    }

    @AllArgsConstructor
    private static class ProjectionMeters {

        private final Timer applied;
        private final Timer handedOver;
        private final Timer skipped;
        private final Timer deleted;
        private final Timer failed;
        private final Timer mongoUnavailable;
    }
}
