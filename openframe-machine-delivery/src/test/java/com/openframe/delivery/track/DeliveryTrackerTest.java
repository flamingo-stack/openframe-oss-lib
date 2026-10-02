package com.openframe.delivery.track;

import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.config.DeliveryTestPolicies;
import com.openframe.delivery.event.DeliveryAckedEvent;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.spec.TestSeed;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.Instant;

import static com.openframe.delivery.config.DeliveryTestPolicies.RESULT_TIMEOUT;
import static com.openframe.delivery.config.DeliveryTestPolicies.TTL;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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
    private static final DeliveryRef REF = new DeliveryRef(DeliveryType.TOOL_INSTALLATION, TARGET_ID, DISPATCH_ID);

    @Mock private MachineDeliveryRepository repository;
    @Mock private DeliveryCloser closer;
    @Mock private ApplicationEventPublisher events;

    @Captor private ArgumentCaptor<Instant> atCaptor;
    @Captor private ArgumentCaptor<Instant> untilCaptor;
    @Captor private ArgumentCaptor<DeliveryAckedEvent> ackedCaptor;

    private DeliveryTracker tracker;

    @BeforeEach
    void setUp() {
        tracker = new DeliveryTracker(repository, DeliveryTestPolicies.properties(), closer, events);
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
    }

    @Test
    void acknowledge_rowJustAcked_eventPublishedWithTheKey() {
        // setup
        when(repository.markAcked(eq(DELIVERY_ID), eq(DISPATCH_ID), eq(DeliveryStatus.UNACKED), any(Instant.class), any(Instant.class))).thenReturn(true);

        // execution
        tracker.acknowledge(REF, MACHINE_ID);

        // verifications
        verify(events).publishEvent(ackedCaptor.capture());
        DeliveryAckedEvent event = ackedCaptor.getValue();
        assertThat(event.getType()).isEqualTo(DeliveryType.TOOL_INSTALLATION);
        assertThat(event.getTargetId()).isEqualTo(TARGET_ID);
        assertThat(event.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(event.getDispatchId()).isEqualTo(DISPATCH_ID);
    }

    @Test
    void acknowledge_staleDispatch_noEvent() {
        // setup
        when(repository.markAcked(eq(DELIVERY_ID), eq(DISPATCH_ID), eq(DeliveryStatus.UNACKED), any(Instant.class), any(Instant.class))).thenReturn(false);

        // execution
        tracker.acknowledge(REF, MACHINE_ID);

        // verifications
        verifyNoInteractions(events);
    }

    @Test
    void done_seed_completableRowOfTheSeedKeyMarkedDone() {
        // setup
        when(repository.markDone(eq(DELIVERY_ID), eq(DeliveryStatus.COMPLETABLE), atCaptor.capture(), untilCaptor.capture())).thenReturn(true);

        // execution
        tracker.done(new TestSeed(MACHINE_ID));

        // verifications
        Instant finishedAt = atCaptor.getValue();
        assertThat(untilCaptor.getValue()).isEqualTo(finishedAt.plusSeconds(TTL));
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
    void fail_agentReportedError_closerAsked() {
        // execution
        tracker.fail(REF, MACHINE_ID, ERROR);

        // verifications
        verify(closer).failReported(eq(DeliveryType.TOOL_INSTALLATION), eq(TARGET_ID), eq(MACHINE_ID), eq(DISPATCH_ID), eq(ERROR), any(Instant.class));
    }
}
