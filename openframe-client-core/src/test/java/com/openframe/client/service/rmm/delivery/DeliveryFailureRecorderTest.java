package com.openframe.client.service.rmm.delivery;

import com.openframe.client.metrics.DeliveryMetrics;
import com.openframe.client.service.rmm.delivery.DeliveryProperties.Policy;
import com.openframe.data.document.rmm.delivery.DeliveryFailure;
import com.openframe.data.document.rmm.delivery.DeliveryKind;
import com.openframe.data.document.rmm.delivery.DeliveryStatus;
import com.openframe.data.document.rmm.delivery.MachineDelivery;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.nats.model.ClientUninstallMessage;
import com.openframe.data.repository.rmm.MachineDeliveryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryFailureRecorderTest {

    private static final long TTL = 604_800L;

    @Mock private MachineDeliveryRepository repository;
    @Mock private DeliverySpecRegistry registry;
    @Mock private DeliveryMetrics metrics;
    @Mock private DeliverySpec<ClientUninstallMessage> spec;

    private DeliveryFailureRecorder recorder;

    private MachineDelivery delivery;

    @BeforeEach
    void setUp() {
        Policy defaults = new Policy();
        defaults.setAckThresholdSeconds(30L);
        defaults.setMaxAttempts(3);
        defaults.setOfflineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT);
        defaults.setReconnectWindowSeconds(86_400L);
        defaults.setResultTimeoutSeconds(600L);
        defaults.setTtlSeconds(TTL);
        DeliveryProperties properties = new DeliveryProperties();
        properties.setDefaults(defaults);

        delivery = MachineDelivery.builder()
                .kind(DeliveryKind.CLIENT_UNINSTALL)
                .status(DeliveryStatus.PENDING)
                .attempts(5)
                .build();

        recorder = new DeliveryFailureRecorder(repository, registry, properties, metrics);
    }

    @Test
    void fail_exhausted_rowFailedMetricCountedSpecNotified() {
        // setup
        Instant now = Instant.now();
        doReturn(spec).when(registry).require(DeliveryKind.CLIENT_UNINSTALL);

        // execution
        recorder.fail(delivery, DeliveryFailure.EXHAUSTED, now);

        // verifications
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(delivery.getFailure()).isEqualTo(DeliveryFailure.EXHAUSTED);
        assertThat(delivery.getFinishedAt()).isEqualTo(now);
        assertThat(delivery.getExpiresAt()).isEqualTo(now.plusSeconds(TTL));
        verify(repository).save(delivery);
        verify(metrics).recordFailed(DeliveryKind.CLIENT_UNINSTALL, DeliveryFailure.EXHAUSTED);
        verify(spec).onFailed(delivery, DeliveryFailure.EXHAUSTED);
    }
}
