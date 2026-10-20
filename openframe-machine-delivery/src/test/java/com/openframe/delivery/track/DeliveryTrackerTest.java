package com.openframe.delivery.track;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.config.DeliveryTestPolicies;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.delivery.spec.DeliveryRef;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static com.openframe.delivery.config.DeliveryTestPolicies.RESULT_TIMEOUT;
import static com.openframe.delivery.config.DeliveryTestPolicies.TTL;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryTrackerTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String TARGET_ID = "fleetmdm-agent";
    private static final String DELIVERY_ID = DeliveryId.of(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID);
    private static final String DISPATCH_ID = "d-1";
    private static final String ERROR = "download failed";
    private static final String REASON = "request revoked";
    private static final String REJECTED_PAST_DEADLINE = "deadline";
    private static final DeliveryRef REF = new DeliveryRef(DeliveryType.TOOL_INSTALLATION, TARGET_ID, DISPATCH_ID);

    @Mock private MachineDeliveryRepository repository;
    @Mock private DeliveryCloser closer;
    @Mock private DeliveryMetrics metrics;

    @Captor private ArgumentCaptor<Instant> atCaptor;
    @Captor private ArgumentCaptor<Instant> untilCaptor;

    private DeliveryTracker tracker;

    @BeforeEach
    void setUp() {
        tracker = new DeliveryTracker(repository, DeliveryTestPolicies.properties(), closer, metrics);
    }

    @Test
    void acknowledge_ref_unackedRowMarkedAckedWithResultDeadline() {
        // setup
        when(repository.markAcked(eq(DELIVERY_ID), eq(DISPATCH_ID), eq(DeliveryStatus.UNACKED), atCaptor.capture(), untilCaptor.capture())).thenReturn(true);

        // execution
        tracker.acknowledge(REF, MACHINE_ID);

        // verifications
        Instant ackedAt = atCaptor.getValue();
        assertThat(untilCaptor.getValue()).isEqualTo(ackedAt.plusSeconds(RESULT_TIMEOUT));
        verify(repository, never()).markFailedPastDeadline(any(), any(), any(), any(), any());
        verifyNoInteractions(metrics);
    }

    @Test
    void acknowledge_ref_afterTheDeadline_rowFailedDeadlineAndTheAckCountedAsRejected() {
        // setup
        when(repository.markAcked(eq(DELIVERY_ID), eq(DISPATCH_ID), eq(DeliveryStatus.UNACKED), any(Instant.class), any(Instant.class))).thenReturn(false);
        when(repository.markFailedPastDeadline(eq(DELIVERY_ID), eq(DISPATCH_ID), eq(DeliveryStatus.UNACKED), atCaptor.capture(), untilCaptor.capture())).thenReturn(true);

        // execution
        tracker.acknowledge(REF, MACHINE_ID);

        // verifications
        Instant failedAt = atCaptor.getValue();
        assertThat(untilCaptor.getValue()).isEqualTo(failedAt.plusSeconds(TTL));
        verify(metrics).recordFailed(DeliveryType.TOOL_INSTALLATION, DeliveryFailure.DEADLINE);
        verify(metrics).recordResultRejected(REJECTED_PAST_DEADLINE);
    }

    @Test
    void acknowledge_ref_noUnackedRow_nothingCounted() {
        // setup
        when(repository.markAcked(eq(DELIVERY_ID), eq(DISPATCH_ID), eq(DeliveryStatus.UNACKED), any(Instant.class), any(Instant.class))).thenReturn(false);
        when(repository.markFailedPastDeadline(eq(DELIVERY_ID), eq(DISPATCH_ID), eq(DeliveryStatus.UNACKED), any(Instant.class), any(Instant.class))).thenReturn(false);

        // execution
        tracker.acknowledge(REF, MACHINE_ID);

        // verifications
        verifyNoInteractions(metrics, closer);
    }

    @Test
    void acknowledge_byKey_currentDispatchOfTheRowAcknowledged() {
        // setup
        when(repository.findById(DELIVERY_ID)).thenReturn(Optional.of(row()));
        when(repository.markAcked(eq(DELIVERY_ID), eq(DISPATCH_ID), eq(DeliveryStatus.UNACKED), any(Instant.class), any(Instant.class))).thenReturn(true);

        // execution
        tracker.acknowledge(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID);

        // verifications
        verify(repository).markAcked(eq(DELIVERY_ID), eq(DISPATCH_ID), eq(DeliveryStatus.UNACKED), any(Instant.class), any(Instant.class));
    }

    @Test
    void acknowledge_byKey_noRow_nothingMarked() {
        // setup
        when(repository.findById(DELIVERY_ID)).thenReturn(Optional.empty());

        // execution
        tracker.acknowledge(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID);

        // verifications
        verify(repository, never()).markAcked(any(), any(), any(), any(), any());
        verifyNoInteractions(metrics, closer);
    }

    @Test
    void done_ref_openOrFailedRowMarkedDoneWithTtlExpiry() {
        // setup
        when(repository.markDone(eq(DELIVERY_ID), eq(DISPATCH_ID), eq(DeliveryStatus.COMPLETABLE), atCaptor.capture(), untilCaptor.capture())).thenReturn(true);

        // execution
        tracker.done(REF, MACHINE_ID);

        // verifications
        Instant finishedAt = atCaptor.getValue();
        assertThat(untilCaptor.getValue()).isEqualTo(finishedAt.plusSeconds(TTL));
    }

    @Test
    void done_byKey_currentDispatchOfTheRowMarkedDone() {
        // setup
        when(repository.findById(DELIVERY_ID)).thenReturn(Optional.of(row()));
        when(repository.markDone(eq(DELIVERY_ID), eq(DISPATCH_ID), eq(DeliveryStatus.COMPLETABLE), any(Instant.class), any(Instant.class))).thenReturn(true);

        // execution
        tracker.done(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID);

        // verifications
        verify(repository).markDone(eq(DELIVERY_ID), eq(DISPATCH_ID), eq(DeliveryStatus.COMPLETABLE), any(Instant.class), any(Instant.class));
    }

    @Test
    void fail_agentReportedError_closerAsked() {
        // execution
        tracker.fail(REF, MACHINE_ID, ERROR);

        // verifications
        verify(closer).failReported(eq(DeliveryType.TOOL_INSTALLATION), eq(TARGET_ID), eq(MACHINE_ID), eq(DISPATCH_ID), eq(ERROR), any(Instant.class));
    }

    @Test
    void cancel_byKey_openRowCancelledWithTheReason() {
        // setup
        MachineDelivery row = row();
        when(repository.findById(DELIVERY_ID)).thenReturn(Optional.of(row));

        // execution
        tracker.cancel(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID, REASON);

        // verifications
        verify(closer).cancel(eq(row), eq(DeliveryStatus.OPEN), eq(REASON), any(Instant.class));
    }

    @Test
    void cancel_byKey_noRow_nothingCancelled() {
        // setup
        when(repository.findById(DELIVERY_ID)).thenReturn(Optional.empty());

        // execution
        tracker.cancel(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID, REASON);

        // verifications
        verifyNoInteractions(closer);
    }

    private static MachineDelivery row() {
        return MachineDelivery.builder()
                .id(DELIVERY_ID)
                .type(DeliveryType.TOOL_INSTALLATION)
                .targetId(TARGET_ID)
                .machineId(MACHINE_ID)
                .dispatchId(DISPATCH_ID)
                .status(DeliveryStatus.PENDING)
                .build();
    }
}
