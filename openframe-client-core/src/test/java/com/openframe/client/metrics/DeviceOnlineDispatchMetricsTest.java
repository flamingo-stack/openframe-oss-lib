package com.openframe.client.metrics;

import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DeviceOnlineDispatchMetricsTest {

    private static final String PENDING_GAUGE = "openframe.rmm.device_online.pending";
    private static final String BATCH_SIZE_GAUGE = "openframe.rmm.device_online.batch_size";
    private static final long BATCH_SIZE = 500L;

    private final DeviceOnlineDispatchRepository repository = mock(DeviceOnlineDispatchRepository.class);
    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();

    @Test
    void gaugeReportsNewSentinelCountAfterRefresh() {
        DeviceOnlineDispatchMetrics metrics = new DeviceOnlineDispatchMetrics(repository, registry, BATCH_SIZE);

        // Before the first refresh the gauge sits at its initial value.
        assertThat(registry.get(PENDING_GAUGE).gauge().value()).isEqualTo(0.0);

        when(repository.countByStatus(DeviceOnlineDispatchStatus.NEW)).thenReturn(742L);
        metrics.refreshPending();

        assertThat(registry.get(PENDING_GAUGE).gauge().value()).isEqualTo(742.0);
    }

    @Test
    void batchSizeGaugePublishesConfiguredThreshold() {
        new DeviceOnlineDispatchMetrics(repository, registry, BATCH_SIZE);

        // The alert compares pending > batch_size, so the configured batch-size is published as a gauge.
        assertThat(registry.get(BATCH_SIZE_GAUGE).gauge().value()).isEqualTo(500.0);
    }

    @Test
    void refreshSwallowsRepositoryErrorsAndKeepsLastValue() {
        DeviceOnlineDispatchMetrics metrics = new DeviceOnlineDispatchMetrics(repository, registry, BATCH_SIZE);

        when(repository.countByStatus(DeviceOnlineDispatchStatus.NEW)).thenReturn(10L);
        metrics.refreshPending();

        // A failing count must not blow up the scheduled task; the last good value stays published.
        when(repository.countByStatus(DeviceOnlineDispatchStatus.NEW)).thenThrow(new RuntimeException("mongo down"));
        metrics.refreshPending();

        assertThat(registry.get(PENDING_GAUGE).gauge().value()).isEqualTo(10.0);
    }
}
