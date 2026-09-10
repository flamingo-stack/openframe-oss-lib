package com.openframe.client.metrics;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.ScriptExecution;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Map;

import static java.util.stream.Collectors.counting;
import static java.util.stream.Collectors.groupingBy;

@Component
public class ScriptExecutionWatchdogMetrics {

    private static final String REAPED_COUNTER = "openframe.rmm.execution.watchdog.reaped";
    private static final String DELIVERY_RETRIED_COUNTER = "openframe.rmm.execution.delivery.retried";
    private static final String DELIVERY_FAILED_COUNTER = "openframe.rmm.execution.delivery.failed";
    private static final String TAG_KIND = "kind";
    private static final String KIND_SCRIPT = "script";
    private static final String TAG_REASON = "reason";
    private static final String TAG_SOURCE = "source";
    private static final String TAG_MANAGER = "manager";
    private static final String REASON_EXHAUSTED = "exhausted";
    private static final String REASON_OFFLINE = "offline";
    private static final String MANAGER_NONE = "NONE";

    private final MeterRegistry meterRegistry;

    public ScriptExecutionWatchdogMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    public void recordScriptReaped(Collection<ScriptExecution> reaped) {
        Tags tags = Tags.of(TAG_KIND, KIND_SCRIPT);
        countByOrigin(REAPED_COUNTER, tags, reaped);
    }

    public void recordDeliveryRetried(long count) {
        if (count <= 0) {
            return;
        }
        meterRegistry.counter(DELIVERY_RETRIED_COUNTER, TAG_KIND, KIND_SCRIPT).increment(count);
    }

    public void recordDeliveryFailedExhausted(Collection<ScriptExecution> failed) {
        recordDeliveryFailed(failed, REASON_EXHAUSTED);
    }

    public void recordDeliveryFailedOffline(Collection<ScriptExecution> failed) {
        recordDeliveryFailed(failed, REASON_OFFLINE);
    }

    private void recordDeliveryFailed(Collection<ScriptExecution> failed, String reason) {
        Tags tags = Tags.of(TAG_KIND, KIND_SCRIPT, TAG_REASON, reason);
        countByOrigin(DELIVERY_FAILED_COUNTER, tags, failed);
    }

    private void countByOrigin(String counterName, Tags tags, Collection<ScriptExecution> rows) {
        Map<Tags, Long> counts = rows.stream().collect(groupingBy(ScriptExecutionWatchdogMetrics::originTags, counting()));
        counts.forEach((origin, count) -> meterRegistry.counter(counterName, tags.and(origin)).increment(count));
    }

    // Rows written before the field existed have no source; History reads them as MANUAL, so the metric must too.
    private static Tags originTags(ScriptExecution row) {
        ExecutionSource source = row.getSource() != null ? row.getSource() : ExecutionSource.MANUAL;
        PackageManagerType packageManager = row.getPackageManager();
        String managerTag = packageManager != null ? packageManager.name() : MANAGER_NONE;
        return Tags.of(TAG_SOURCE, source.name(), TAG_MANAGER, managerTag);
    }
}
