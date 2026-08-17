package com.openframe.stream.metrics;

import com.openframe.data.document.rmm.ExecutionStatus;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

@Component
public class RmmExecutionMetrics {

    public static final String KIND_SCRIPT = "script";
    public static final String KIND_COMMAND = "command";

    private static final String COMPLETED_COUNTER = "openframe.rmm.execution.completed";
    private static final String LATENCY_TIMER = "openframe.rmm.execution.latency";

    @Nullable
    private final MeterRegistry registry;

    public RmmExecutionMetrics(@Nullable MeterRegistry registry) {
        this.registry = registry;
    }

    public void recordCompleted(String kind, ExecutionStatus status, Instant dispatchedAt, Instant finishedAt) {
        if (registry == null) {
            return;
        }
        String statusTag = status != null ? status.name() : "UNKNOWN";
        registry.counter(COMPLETED_COUNTER, "kind", kind, "status", statusTag).increment();

        if (dispatchedAt != null && finishedAt != null) {
            Timer.builder(LATENCY_TIMER)
                    .description("Time from dispatch to result write-back for an RMM execution")
                    .tag("kind", kind)
                    .tag("status", statusTag)
                    .publishPercentileHistogram()
                    .register(registry)
                    .record(Duration.between(dispatchedAt, finishedAt));
        }
    }
}
