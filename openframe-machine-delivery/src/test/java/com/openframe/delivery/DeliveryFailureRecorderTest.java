package com.openframe.delivery;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static com.openframe.delivery.DeliveryTestPolicies.TTL;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class DeliveryFailureRecorderTest {

    @Mock private MachineDeliveryRepository repository;
    @Mock private DeliverySpecRegistry registry;
    @Mock private DeliveryMetrics metrics;
    @Mock private DeliverySpec<TestPayload> spec;

    private DeliveryFailureRecorder recorder;

    private MachineDelivery delivery;

    @BeforeEach
    void setUp() {
        delivery = MachineDelivery.builder()
                .type(DeliveryType.CLIENT_UNINSTALL)
                .status(DeliveryStatus.PENDING)
                .attempts(5)
                .build();
        DeliveryProperties properties = DeliveryTestPolicies.properties();
        recorder = new DeliveryFailureRecorder(repository, registry, properties, metrics);
    }

    @Test
    void fail_exhausted_rowFailedMetricCountedSpecNotified() {
        // setup
        Instant now = Instant.now();
        doReturn(spec).when(registry).require(DeliveryType.CLIENT_UNINSTALL);

        // execution
        recorder.fail(delivery, DeliveryFailure.EXHAUSTED, now);

        // verifications
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(delivery.getFailure()).isEqualTo(DeliveryFailure.EXHAUSTED);
        assertThat(delivery.getFinishedAt()).isEqualTo(now);
        assertThat(delivery.getExpiresAt()).isEqualTo(now.plusSeconds(TTL));
        verify(repository).save(delivery);
        verify(metrics).recordFailed(DeliveryType.CLIENT_UNINSTALL, DeliveryFailure.EXHAUSTED);
        verify(spec).onFailed(delivery, DeliveryFailure.EXHAUSTED);
    }
}
