package com.openframe.delivery.track;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.config.DeliveryTestPolicies;
import com.openframe.delivery.metrics.DeliveryMetrics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.time.Instant;

import static com.openframe.delivery.config.DeliveryTestPolicies.TTL;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.ArgumentMatchers.any;
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
    private static final int MAX_RUNS = 3;
    private static final long RERUN_AFTER = 10_800L;

    @Mock private MachineDeliveryRepository repository;
    @Mock private DeliveryMetrics metrics;

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
                .targetId(TARGET_ID)
                .machineId(MACHINE_ID)
                .dispatchId(DISPATCH_ID)
                .status(DeliveryStatus.PENDING)
                .attempts(5)
                .dispatchedAt(dispatchedAt)
                .build();
        DeliveryProperties properties = DeliveryTestPolicies.properties();
        closer = new DeliveryCloser(repository, properties, metrics);
    }

    @Test
    void fail_rowStillUnacked_rowFailedMetricCounted() {
        // setup
        Instant expiresAt = now.plusSeconds(TTL);
        when(repository.markFailed(DELIVERY_ID, DeliveryStatus.UNACKED, dispatchedAt, DeliveryFailure.EXHAUSTED, now, expiresAt)).thenReturn(true);

        // execution
        closer.fail(delivery, DeliveryFailure.EXHAUSTED, DeliveryStatus.UNACKED, now);

        // verifications
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(delivery.getFailure()).isEqualTo(DeliveryFailure.EXHAUSTED);
        assertThat(delivery.getFinishedAt()).isEqualTo(now);
        assertThat(delivery.getExpiresAt()).isEqualTo(expiresAt);
        verify(metrics).recordFailed(DeliveryType.CLIENT_UNINSTALL, DeliveryFailure.EXHAUSTED);
    }

    @Test
    void fail_runsLeft_rowScheduledForARerunNotFailed() {
        // setup
        DeliveryProperties properties = DeliveryTestPolicies.properties();
        properties.getDefaults().setMaxRuns(MAX_RUNS);
        closer = new DeliveryCloser(repository, properties, metrics);
        when(repository.scheduleRerun(DELIVERY_ID, DeliveryStatus.UNACKED, dispatchedAt, now.plusSeconds(RERUN_AFTER))).thenReturn(true);

        // execution
        closer.fail(delivery, DeliveryFailure.EXHAUSTED, DeliveryStatus.UNACKED, now);

        // verifications
        verify(repository, never()).markFailed(any(), any(), any(Instant.class), any(), any(), any());
        verify(metrics).recordRerun(DeliveryType.CLIENT_UNINSTALL, DeliveryFailure.EXHAUSTED);
        verify(metrics, never()).recordFailed(any(), any());
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(delivery.getReruns()).isEqualTo(1);
        assertThat(delivery.getAttempts()).isZero();
        assertThat(delivery.getDueAt()).isEqualTo(now.plusSeconds(RERUN_AFTER));
    }

    @Test
    void fail_offlineWindowOver_rowFailedEvenWithRunsLeft() {
        // setup
        DeliveryProperties properties = DeliveryTestPolicies.properties();
        properties.getDefaults().setMaxRuns(MAX_RUNS);
        closer = new DeliveryCloser(repository, properties, metrics);
        Instant expiresAt = now.plusSeconds(TTL);
        when(repository.markFailed(DELIVERY_ID, DeliveryStatus.UNACKED, dispatchedAt, DeliveryFailure.OFFLINE, now, expiresAt)).thenReturn(true);

        // execution
        closer.fail(delivery, DeliveryFailure.OFFLINE, DeliveryStatus.UNACKED, now);

        // verifications
        verify(repository, never()).scheduleRerun(any(), any(), any(Instant.class), any());
        verify(metrics, never()).recordRerun(any(), any());
        verify(metrics).recordFailed(DeliveryType.CLIENT_UNINSTALL, DeliveryFailure.OFFLINE);
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(delivery.getReruns()).isZero();
    }

    @Test
    void fail_lastRunDone_rowFailedAsBefore() {
        // setup
        DeliveryProperties properties = DeliveryTestPolicies.properties();
        properties.getDefaults().setMaxRuns(MAX_RUNS);
        closer = new DeliveryCloser(repository, properties, metrics);
        delivery.setReruns(MAX_RUNS - 1);
        Instant expiresAt = now.plusSeconds(TTL);
        when(repository.markFailed(DELIVERY_ID, DeliveryStatus.UNACKED, dispatchedAt, DeliveryFailure.TIMEOUT, now, expiresAt)).thenReturn(true);

        // execution
        closer.fail(delivery, DeliveryFailure.TIMEOUT, DeliveryStatus.UNACKED, now);

        // verifications
        verify(repository, never()).scheduleRerun(any(), any(), any(Instant.class), any());
        verify(metrics).recordFailed(DeliveryType.CLIENT_UNINSTALL, DeliveryFailure.TIMEOUT);
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.FAILED);
    }

    @Test
    void failReported_runsLeft_rowScheduledForARerunByItsDispatch() {
        // setup
        DeliveryProperties properties = DeliveryTestPolicies.properties();
        properties.getDefaults().setMaxRuns(MAX_RUNS);
        closer = new DeliveryCloser(repository, properties, metrics);
        when(repository.findByIdOnPrimary(DELIVERY_ID)).thenReturn(Optional.of(delivery));
        when(repository.scheduleRerun(DELIVERY_ID, DISPATCH_ID, DeliveryStatus.OPEN, now.plusSeconds(RERUN_AFTER))).thenReturn(true);

        // execution
        closer.failReported(DeliveryType.CLIENT_UNINSTALL, TARGET_ID, MACHINE_ID, DISPATCH_ID, ERROR, now);

        // verifications
        verify(repository, never()).markFailed(any(), any(), any(), any(), any(), any(), any());
        verify(metrics).recordRerun(DeliveryType.CLIENT_UNINSTALL, DeliveryFailure.AGENT_ERROR);
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
        verifyNoInteractions(metrics);
    }

    @Test
    void failReported_openRowOfThisDispatch_rowFailedMetricCounted() {
        // setup
        when(repository.markFailed(DELIVERY_ID, DISPATCH_ID, DeliveryStatus.OPEN, DeliveryFailure.AGENT_ERROR, ERROR, now, now.plusSeconds(TTL))).thenReturn(true);

        // execution
        closer.failReported(DeliveryType.CLIENT_UNINSTALL, TARGET_ID, MACHINE_ID, DISPATCH_ID, ERROR, now);

        // verifications
        verify(metrics).recordFailed(DeliveryType.CLIENT_UNINSTALL, DeliveryFailure.AGENT_ERROR);
    }

    @Test
    void failReported_rowOfAnotherDispatchOrClosed_nothingRecorded() {
        // setup
        when(repository.markFailed(DELIVERY_ID, DISPATCH_ID, DeliveryStatus.OPEN, DeliveryFailure.AGENT_ERROR, ERROR, now, now.plusSeconds(TTL))).thenReturn(false);

        // execution
        closer.failReported(DeliveryType.CLIENT_UNINSTALL, TARGET_ID, MACHINE_ID, DISPATCH_ID, ERROR, now);

        // verifications
        verifyNoInteractions(metrics);
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
        verifyNoInteractions(metrics);
    }
}
