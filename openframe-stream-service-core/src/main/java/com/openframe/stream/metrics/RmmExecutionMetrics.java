package com.openframe.stream.metrics;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

@Component
public class RmmExecutionMetrics {

    private static final String KIND_SCRIPT = "script";
    private static final String KIND_COMMAND = "command";

    private static final String COMPLETED_COUNTER = "openframe.rmm.execution.completed";
    private static final String LATENCY_TIMER = "openframe.rmm.execution.latency";
    private static final String LATENCY_DESCRIPTION = "Time from dispatch to result write-back for an RMM execution";

    private static final Duration LATENCY_MIN = Duration.ofSeconds(1);
    private static final Duration LATENCY_MAX = Duration.ofMinutes(15);

    private static final String TAG_KIND = "kind";
    private static final String TAG_STATUS = "status";
    private static final String TAG_SOURCE = "source";
    private static final String TAG_MANAGER = "manager";
    private static final String STATUS_UNKNOWN = "UNKNOWN";
    private static final String MANAGER_NONE = "NONE";

    private final MeterRegistry registry;

    public RmmExecutionMetrics(MeterRegistry registry) {
        this.registry = registry;
    }

    public void recordScriptCompleted(ExecutionStatus status, ExecutionSource source, PackageManagerType packageManager,
                                      Instant dispatchedAt, Instant finishedAt) {
        String sourceTag = sourceTag(source);
        String managerTag = managerTag(packageManager);
        recordCompleted(KIND_SCRIPT, status, sourceTag, managerTag, dispatchedAt, finishedAt);
    }

    public void recordCommandCompleted(ExecutionStatus status, Instant dispatchedAt, Instant finishedAt) {
        String sourceTag = ExecutionSource.MANUAL.name();
        recordCompleted(KIND_COMMAND, status, sourceTag, MANAGER_NONE, dispatchedAt, finishedAt);
    }

    private void recordCompleted(String kind, ExecutionStatus status, String sourceTag, String managerTag,
                                 Instant dispatchedAt, Instant finishedAt) {
        String statusTag = status != null ? status.name() : STATUS_UNKNOWN;
        Tags tags = Tags.of(TAG_KIND, kind, TAG_STATUS, statusTag, TAG_SOURCE, sourceTag, TAG_MANAGER, managerTag);
        registry.counter(COMPLETED_COUNTER, tags).increment();

        if (dispatchedAt != null && finishedAt != null) {
            Timer.builder(LATENCY_TIMER)
                    .description(LATENCY_DESCRIPTION)
                    .tags(tags)
                    .minimumExpectedValue(LATENCY_MIN)
                    .maximumExpectedValue(LATENCY_MAX)
                    .publishPercentileHistogram()
                    .register(registry)
                    .record(Duration.between(dispatchedAt, finishedAt));
        }
    }

    // Rows written before the field existed have no source; History reads them as MANUAL, so the metric must too.
    private static String sourceTag(ExecutionSource source) {
        return source != null ? source.name() : ExecutionSource.MANUAL.name();
    }

    private static String managerTag(PackageManagerType packageManager) {
        return packageManager != null ? packageManager.name() : MANAGER_NONE;
    }
}
