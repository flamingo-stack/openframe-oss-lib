package com.openframe.stream.metrics;

import com.openframe.data.document.rmm.ExecutionStatus;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

@Component
public class RmmExecutionMetrics {

    public static final String KIND_SCRIPT = "script";
    public static final String KIND_COMMAND = "command";

    private static final String COMPLETED_COUNTER = "openframe.rmm.execution.completed";
    private static final String LATENCY_TIMER = "openframe.rmm.execution.latency";
    private static final String LATENCY_DESCRIPTION = "Time from dispatch to result write-back for an RMM execution";

    private static final Duration LATENCY_MIN = Duration.ofSeconds(1);
    private static final Duration LATENCY_MAX = Duration.ofMinutes(15);

    private static final String TAG_KIND = "kind";
    private static final String TAG_STATUS = "status";
    private static final String STATUS_UNKNOWN = "UNKNOWN";

    private final MeterRegistry registry;

    public RmmExecutionMetrics(MeterRegistry registry) {
        this.registry = registry;
    }

    public void recordCompleted(String kind, ExecutionStatus status, Instant dispatchedAt, Instant finishedAt) {
        String statusTag = status != null ? status.name() : STATUS_UNKNOWN;
        registry.counter(COMPLETED_COUNTER, TAG_KIND, kind, TAG_STATUS, statusTag).increment();

        if (dispatchedAt != null && finishedAt != null) {
            Timer.builder(LATENCY_TIMER)
                    .description(LATENCY_DESCRIPTION)
                    .tag(TAG_KIND, kind)
                    .tag(TAG_STATUS, statusTag)
                    .minimumExpectedValue(LATENCY_MIN)
                    .maximumExpectedValue(LATENCY_MAX)
                    .publishPercentileHistogram()
                    .register(registry)
                    .record(Duration.between(dispatchedAt, finishedAt));
        }
    }
}
