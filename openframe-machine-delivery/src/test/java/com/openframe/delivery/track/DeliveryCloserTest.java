package com.openframe.delivery.track;

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
import java.util.Optional;

import static com.openframe.delivery.config.DeliveryTestPolicies.TTL;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryCloserTest {

    private static final String DELIVERY_ID = "CLIENT_UNINSTALL:openframe-client:mach-42";
    private static final String REASON = "machine gone";
    private static final String TARGET_ID = "openframe-client";
    private static final String MACHINE_ID = "mach-42";
    private static final String DISPATCH_ID = "d-1";
    private static final String ERROR = "download failed";

    @Mock private MachineDeliveryRepository repository;
    @Mock private DeliverySpecRegistry registry;
    @Mock private DeliveryMetrics metrics;
    @Mock private DeliverySpec<TestSeed, TestPayload> spec;

    private DeliveryCloser closer;

    private MachineDelivery delivery;
    private Instant now;
    private Instant dispatchedAt;

    @BeforeEach
    void setUp() {
        now = Instant.now();
        dispatchedAt = now.minusSeconds(120);
        delivery = MachineDelivery.builder()
                .id(DELIVERY_ID)
                .type(DeliveryType.CLIENT_UNINSTALL)
                .status(DeliveryStatus.PENDING)
                .attempts(5)
                .dispatchedAt(dispatchedAt)
                .build();
        DeliveryProperties properties = DeliveryTestPolicies.properties();
        closer = new DeliveryCloser(repository, registry, properties, metrics);
    }

    @Test
    void fail_rowStillUnacked_rowFailedMetricCountedSpecNotified() {
        // setup
        Instant expiresAt = now.plusSeconds(TTL);
        when(repository.markFailed(DELIVERY_ID, DeliveryStatus.UNACKED, dispatchedAt, DeliveryFailure.EXHAUSTED, now, expiresAt)).thenReturn(true);
        doReturn(Optional.of(spec)).when(registry).find(DeliveryType.CLIENT_UNINSTALL);

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
        when(repository.markFailed(DELIVERY_ID, DeliveryStatus.UNACKED, dispatchedAt, DeliveryFailure.EXHAUSTED, now, expiresAt)).thenReturn(false);

        // execution
        closer.fail(delivery, DeliveryFailure.EXHAUSTED, DeliveryStatus.UNACKED, now);

        // verifications
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        verifyNoInteractions(metrics, registry, spec);
    }

    @Test
    void fail_typeWithoutSpec_rowStillFailedSpecSkipped() {
        // setup
        Instant expiresAt = now.plusSeconds(TTL);
        when(repository.markFailed(DELIVERY_ID, DeliveryStatus.AWAITING_RESULT, dispatchedAt, DeliveryFailure.TIMEOUT, now, expiresAt)).thenReturn(true);
        when(registry.find(DeliveryType.CLIENT_UNINSTALL)).thenReturn(Optional.empty());

        // execution
        closer.fail(delivery, DeliveryFailure.TIMEOUT, DeliveryStatus.AWAITING_RESULT, now);

        // verifications
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.FAILED);
        verify(metrics).recordFailed(DeliveryType.CLIENT_UNINSTALL, DeliveryFailure.TIMEOUT);
        verifyNoInteractions(spec);
    }

    @Test
    void failReported_openRowOfThisDispatch_rowFailedMetricCountedSpecNotified() {
        // setup
        when(repository.markFailed(DELIVERY_ID, DISPATCH_ID, DeliveryStatus.OPEN, DeliveryFailure.AGENT_ERROR, ERROR, now, now.plusSeconds(TTL))).thenReturn(true);
        when(repository.findById(DELIVERY_ID)).thenReturn(Optional.of(delivery));
        doReturn(Optional.of(spec)).when(registry).find(DeliveryType.CLIENT_UNINSTALL);

        // execution
        closer.failReported(DeliveryType.CLIENT_UNINSTALL, TARGET_ID, MACHINE_ID, DISPATCH_ID, ERROR, now);

        // verifications
        verify(metrics).recordFailed(DeliveryType.CLIENT_UNINSTALL, DeliveryFailure.AGENT_ERROR);
        verify(spec).onFailed(delivery, DeliveryFailure.AGENT_ERROR);
    }

    @Test
    void failReported_rowOfAnotherDispatchOrClosed_nothingRecorded() {
        // setup
        when(repository.markFailed(DELIVERY_ID, DISPATCH_ID, DeliveryStatus.OPEN, DeliveryFailure.AGENT_ERROR, ERROR, now, now.plusSeconds(TTL))).thenReturn(false);

        // execution
        closer.failReported(DeliveryType.CLIENT_UNINSTALL, TARGET_ID, MACHINE_ID, DISPATCH_ID, ERROR, now);

        // verifications
        verifyNoInteractions(metrics, registry, spec);
    }

    @Test
    void cancel_rowStillUnackedSameDispatch_rowCancelledWithTtlExpiry() {
        // setup
        Instant expiresAt = now.plusSeconds(TTL);
        when(repository.markCancelled(DELIVERY_ID, DeliveryStatus.UNACKED, dispatchedAt, now, expiresAt)).thenReturn(true);

        // execution
        closer.cancel(delivery, DeliveryStatus.UNACKED, REASON, now);

        // verifications
        verify(repository).markCancelled(DELIVERY_ID, DeliveryStatus.UNACKED, dispatchedAt, now, expiresAt);
        verifyNoInteractions(registry, metrics);
    }
}
