package com.openframe.processing.runner;

import com.openframe.processing.registry.EventProcessorRegistry;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.AllArgsConstructor;

import java.util.Map;
import java.util.Set;

import static java.util.function.Function.identity;
import static java.util.stream.Collectors.toUnmodifiableMap;

// One timer per processor and outcome (its count is the number of events) and one rows counter; registered once, at startup.
public class EventProcessingMetrics {

    private static final String APPLY_TIMER = "openframe.events.processing.apply";
    private static final String ROWS_COUNTER = "openframe.events.processing.rows";
    private static final String TAG_PROCESSOR = "processor";
    private static final String TAG_OUTCOME = "outcome";
    static final String OUTCOME_APPLIED = "applied";
    static final String OUTCOME_FAILED = "failed";
    static final String OUTCOME_MONGO_UNAVAILABLE = "mongo_unavailable";

    private final MeterRegistry meterRegistry;
    private final Map<String, ProcessorMeters> metersByProcessor;

    public EventProcessingMetrics(MeterRegistry meterRegistry, EventProcessorRegistry processorRegistry) {
        this.meterRegistry = meterRegistry;
        Set<String> names = processorRegistry.names();
        this.metersByProcessor = names.stream().collect(toUnmodifiableMap(identity(), this::metersOf));
    }

    Timer.Sample start() {
        return Timer.start(meterRegistry);
    }

    void recordApplied(Timer.Sample sample, String processorName, long rows) {
        ProcessorMeters meters = metersByProcessor.get(processorName);
        sample.stop(meters.applied);
        meters.rows.increment(rows);
    }

    void recordFailed(Timer.Sample sample, String processorName) {
        ProcessorMeters meters = metersByProcessor.get(processorName);
        sample.stop(meters.failed);
    }

    void recordMongoUnavailable(Timer.Sample sample, String processorName) {
        ProcessorMeters meters = metersByProcessor.get(processorName);
        sample.stop(meters.mongoUnavailable);
    }

    private ProcessorMeters metersOf(String processorName) {
        Timer applied = timerOf(processorName, OUTCOME_APPLIED);
        Timer failed = timerOf(processorName, OUTCOME_FAILED);
        Timer mongoUnavailable = timerOf(processorName, OUTCOME_MONGO_UNAVAILABLE);
        Counter rows = meterRegistry.counter(ROWS_COUNTER, TAG_PROCESSOR, processorName);
        return new ProcessorMeters(applied, failed, mongoUnavailable, rows);
    }

    private Timer timerOf(String processorName, String outcome) {
        return meterRegistry.timer(APPLY_TIMER, TAG_PROCESSOR, processorName, TAG_OUTCOME, outcome);
    }

    @AllArgsConstructor
    private static class ProcessorMeters {

        private final Timer applied;
        private final Timer failed;
        private final Timer mongoUnavailable;
        private final Counter rows;
    }
}
