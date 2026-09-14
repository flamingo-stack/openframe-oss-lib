package com.openframe.client.metrics;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.ScriptExecution;
import io.micrometer.core.instrument.search.MeterNotFoundException;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScriptExecutionWatchdogMetricsTest {

    private static final String REAPED_COUNTER = "openframe.rmm.execution.watchdog.reaped";
    private static final String DELIVERY_RETRIED_COUNTER = "openframe.rmm.execution.delivery.retried";
    private static final String DELIVERY_FAILED_COUNTER = "openframe.rmm.execution.delivery.failed";

    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
    private final ScriptExecutionWatchdogMetrics metrics = new ScriptExecutionWatchdogMetrics(registry);

    @Test
    void recordScriptReaped_rowsOfMixedOrigin_oneSeriesPerSourceAndManager() {
        // setup
        List<ScriptExecution> reaped = List.of(
                row(ExecutionSource.SYSTEM_BOOTSTRAP, PackageManagerType.BREW),
                row(ExecutionSource.SYSTEM_BOOTSTRAP, PackageManagerType.BREW),
                row(ExecutionSource.SCHEDULED, null));

        // execution
        metrics.recordScriptReaped(reaped);

        // verifications
        assertThat(registry.get(REAPED_COUNTER)
                .tags("kind", "script", "source", "SYSTEM_BOOTSTRAP", "manager", "BREW")
                .counter().count()).isEqualTo(2.0);
        assertThat(registry.get(REAPED_COUNTER)
                .tags("kind", "script", "source", "SCHEDULED", "manager", "NONE")
                .counter().count()).isEqualTo(1.0);
    }

    @Test
    void recordScriptReaped_rowWithoutSource_countedAsManual() {
        // setup
        List<ScriptExecution> reaped = List.of(row(null, null));

        // execution
        metrics.recordScriptReaped(reaped);

        // verifications
        assertThat(registry.get(REAPED_COUNTER)
                .tags("kind", "script", "source", "MANUAL", "manager", "NONE")
                .counter().count()).isEqualTo(1.0);
    }

    @Test
    void recordScriptReaped_calledTwice_sameSeriesAccumulates() {
        // setup
        List<ScriptExecution> first = List.of(row(ExecutionSource.MANUAL, null), row(ExecutionSource.MANUAL, null));
        List<ScriptExecution> second = List.of(row(ExecutionSource.MANUAL, null));

        // execution
        metrics.recordScriptReaped(first);
        metrics.recordScriptReaped(second);

        // verifications
        assertThat(registry.get(REAPED_COUNTER).tags("source", "MANUAL").counter().count()).isEqualTo(3.0);
    }

    @Test
    void recordScriptReaped_noRows_noMeterRegistered() {
        // setup
        List<ScriptExecution> reaped = List.of();

        // execution
        metrics.recordScriptReaped(reaped);

        // verifications
        assertThatThrownBy(() -> registry.get(REAPED_COUNTER).counter())
                .isInstanceOf(MeterNotFoundException.class);
    }

    @Test
    void recordDeliveryRetried_incrementsKindScriptCounter() {
        // execution
        metrics.recordDeliveryRetried(1);
        metrics.recordDeliveryRetried(2);

        // verifications
        assertThat(registry.get(DELIVERY_RETRIED_COUNTER).tag("kind", "script").counter().count()).isEqualTo(3.0);
    }

    @Test
    void recordDeliveryRetried_nonPositiveCount_noMeterRegistered() {
        // execution
        metrics.recordDeliveryRetried(0);
        metrics.recordDeliveryRetried(-1);

        // verifications
        assertThatThrownBy(() -> registry.get(DELIVERY_RETRIED_COUNTER).counter())
                .isInstanceOf(MeterNotFoundException.class);
    }

    @Test
    void recordDeliveryFailedExhausted_tagsReasonExhaustedAndOrigin() {
        // setup
        List<ScriptExecution> failed = List.of(
                row(ExecutionSource.PACKAGE_INSTALLATION, PackageManagerType.WINGET),
                row(ExecutionSource.PACKAGE_INSTALLATION, PackageManagerType.WINGET));

        // execution
        metrics.recordDeliveryFailedExhausted(failed);

        // verifications
        assertThat(registry.get(DELIVERY_FAILED_COUNTER)
                .tags("kind", "script", "reason", "exhausted", "source", "PACKAGE_INSTALLATION", "manager", "WINGET")
                .counter().count()).isEqualTo(2.0);
    }

    @Test
    void recordDeliveryFailedOffline_tagsReasonOffline() {
        // setup
        List<ScriptExecution> failed = List.of(row(ExecutionSource.SCHEDULED, null));

        // execution
        metrics.recordDeliveryFailedOffline(failed);

        // verifications
        assertThat(registry.get(DELIVERY_FAILED_COUNTER)
                .tags("kind", "script", "reason", "offline", "source", "SCHEDULED", "manager", "NONE")
                .counter().count()).isEqualTo(1.0);
    }

    @Test
    void recordDeliveryFailed_exhaustedAndOffline_separateSeries() {
        // setup
        List<ScriptExecution> exhausted = List.of(row(ExecutionSource.MANUAL, null), row(ExecutionSource.MANUAL, null));
        List<ScriptExecution> offline = List.of(row(ExecutionSource.MANUAL, null));

        // execution
        metrics.recordDeliveryFailedExhausted(exhausted);
        metrics.recordDeliveryFailedOffline(offline);

        // verifications
        assertThat(registry.get(DELIVERY_FAILED_COUNTER).tag("reason", "exhausted").counter().count()).isEqualTo(2.0);
        assertThat(registry.get(DELIVERY_FAILED_COUNTER).tag("reason", "offline").counter().count()).isEqualTo(1.0);
    }

    @Test
    void recordDeliveryFailed_noRows_noMeterRegistered() {
        // setup
        List<ScriptExecution> failed = List.of();

        // execution
        metrics.recordDeliveryFailedExhausted(failed);

        // verifications
        assertThatThrownBy(() -> registry.get(DELIVERY_FAILED_COUNTER).counter())
                .isInstanceOf(MeterNotFoundException.class);
    }

    private static ScriptExecution row(ExecutionSource source, PackageManagerType packageManager) {
        return ScriptExecution.builder().source(source).packageManager(packageManager).build();
    }
}
