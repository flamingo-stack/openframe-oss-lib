package com.openframe.delivery.sweep;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.config.DeliveryTestPolicies;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.delivery.spec.DeliverySpec;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import com.openframe.delivery.spec.TestPayload;
import com.openframe.delivery.spec.TestSeed;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static com.openframe.delivery.config.DeliveryTestPolicies.TTL;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryFailureRecorderTest {

    private static final String DELIVERY_ID = "CLIENT_UNINSTALL:openframe-client:mach-42";

    @Mock private MachineDeliveryRepository repository;
    @Mock private DeliverySpecRegistry registry;
    @Mock private DeliveryMetrics metrics;
    @Mock private DeliverySpec<TestSeed, TestPayload> spec;

    private DeliveryFailureRecorder recorder;

    private MachineDelivery delivery;
    private Instant now;

    @BeforeEach
    void setUp() {
        now = Instant.now();
        delivery = MachineDelivery.builder()
                .id(DELIVERY_ID)
                .type(DeliveryType.CLIENT_UNINSTALL)
                .status(DeliveryStatus.PENDING)
                .attempts(5)
                .build();
        DeliveryProperties properties = DeliveryTestPolicies.properties();
        recorder = new DeliveryFailureRecorder(repository, registry, properties, metrics);
    }

    @Test
    void record_openRow_rowFailedMetricCountedSpecNotified() {
        // setup
        Instant expiresAt = now.plusSeconds(TTL);
        when(repository.markFailed(DELIVERY_ID, DeliveryStatus.OPEN, DeliveryFailure.EXHAUSTED, now, expiresAt)).thenReturn(true);
        doReturn(spec).when(registry).require(DeliveryType.CLIENT_UNINSTALL);

        // execution
        recorder.record(delivery, DeliveryFailure.EXHAUSTED, now);

        // verifications
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(delivery.getFailure()).isEqualTo(DeliveryFailure.EXHAUSTED);
        assertThat(delivery.getFinishedAt()).isEqualTo(now);
        assertThat(delivery.getExpiresAt()).isEqualTo(expiresAt);
        verify(metrics).recordFailed(DeliveryType.CLIENT_UNINSTALL, DeliveryFailure.EXHAUSTED);
        verify(spec).onFailed(delivery, DeliveryFailure.EXHAUSTED);
    }

    @Test
    void record_rowClosedMeanwhile_nothingRecorded() {
        // setup
        Instant expiresAt = now.plusSeconds(TTL);
        when(repository.markFailed(DELIVERY_ID, DeliveryStatus.OPEN, DeliveryFailure.TIMEOUT, now, expiresAt)).thenReturn(false);

        // execution
        recorder.record(delivery, DeliveryFailure.TIMEOUT, now);

        // verifications
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        verifyNoInteractions(metrics, registry);
    }
}
