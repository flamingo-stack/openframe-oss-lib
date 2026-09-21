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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryCloserTest {

    private static final String DELIVERY_ID = "CLIENT_UNINSTALL:openframe-client:mach-42";
    private static final String REASON = "machine gone";

    @Mock private MachineDeliveryRepository repository;
    @Mock private DeliverySpecRegistry registry;
    @Mock private DeliveryMetrics metrics;
    @Mock private DeliverySpec<TestSeed, TestPayload> spec;

    private DeliveryCloser closer;

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
        closer = new DeliveryCloser(repository, registry, properties, metrics);
    }

    @Test
    void fail_rowStillUnacked_rowFailedMetricCountedSpecNotified() {
        // setup
        Instant expiresAt = now.plusSeconds(TTL);
        doReturn(spec).when(registry).require(DeliveryType.CLIENT_UNINSTALL);
        when(repository.markFailed(DELIVERY_ID, DeliveryStatus.UNACKED, DeliveryFailure.EXHAUSTED, now, expiresAt)).thenReturn(true);

        // execution
        closer.fail(delivery, DeliveryFailure.EXHAUSTED, DeliveryStatus.UNACKED, now);

        // verifications
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(delivery.getFailure()).isEqualTo(DeliveryFailure.EXHAUSTED);
        assertThat(delivery.getFinishedAt()).isEqualTo(now);
        assertThat(delivery.getExpiresAt()).isEqualTo(expiresAt);
        verify(metrics).recordFailed(DeliveryType.CLIENT_UNINSTALL, DeliveryFailure.EXHAUSTED);
        verify(spec).onFailed(delivery, DeliveryFailure.EXHAUSTED);
    }

    @Test
    void fail_rowAckedMeanwhile_nothingRecorded() {
        // setup
        Instant expiresAt = now.plusSeconds(TTL);
        doReturn(spec).when(registry).require(DeliveryType.CLIENT_UNINSTALL);
        when(repository.markFailed(DELIVERY_ID, DeliveryStatus.UNACKED, DeliveryFailure.EXHAUSTED, now, expiresAt)).thenReturn(false);

        // execution
        closer.fail(delivery, DeliveryFailure.EXHAUSTED, DeliveryStatus.UNACKED, now);

        // verifications
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        verifyNoInteractions(metrics, spec);
    }

    @Test
    void fail_unregisteredType_throwsBeforeAnyWrite() {
        // setup
        when(registry.require(DeliveryType.CLIENT_UNINSTALL))
                .thenThrow(new IllegalArgumentException("No spec registered for delivery type: CLIENT_UNINSTALL"));

        // execution + verifications
        assertThatThrownBy(() -> closer.fail(delivery, DeliveryFailure.TIMEOUT, DeliveryStatus.AWAITING_RESULT, now))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("CLIENT_UNINSTALL");
        verifyNoInteractions(repository, metrics);
    }

    @Test
    void cancel_rowStillUnacked_rowCancelledWithTtlExpiry() {
        // setup
        Instant expiresAt = now.plusSeconds(TTL);
        when(repository.markCancelled(DELIVERY_ID, DeliveryStatus.UNACKED, now, expiresAt)).thenReturn(true);

        // execution
        closer.cancel(delivery, DeliveryStatus.UNACKED, REASON, now);

        // verifications
        verify(repository).markCancelled(DELIVERY_ID, DeliveryStatus.UNACKED, now, expiresAt);
        verifyNoInteractions(registry, metrics);
    }
}
