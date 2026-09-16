package com.openframe.delivery.track;

import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.config.DeliveryTestPolicies;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static com.openframe.delivery.config.DeliveryTestPolicies.RESULT_TIMEOUT;
import static com.openframe.delivery.config.DeliveryTestPolicies.TTL;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryTrackerTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String TARGET_ID = "fleetmdm-agent";
    private static final String DELIVERY_ID = DeliveryId.of(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID);
    private static final long TWO_ROWS = 2L;
    private static final String DISPATCH_ID = "d-1";

    @Mock private MachineDeliveryRepository repository;

    @Captor private ArgumentCaptor<Instant> atCaptor;
    @Captor private ArgumentCaptor<Instant> untilCaptor;

    private DeliveryTracker tracker;

    @BeforeEach
    void setUp() {
        tracker = new DeliveryTracker(repository, DeliveryTestPolicies.properties());
    }

    @Test
    void acknowledge_typedKey_unackedRowMarkedAckedWithResultDeadline() {
        // setup
        when(repository.markAcked(eq(DELIVERY_ID), eq(DISPATCH_ID), eq(DeliveryStatus.UNACKED), atCaptor.capture(), untilCaptor.capture())).thenReturn(true);

        // execution
        tracker.acknowledge(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID, DISPATCH_ID);

        // verifications
        Instant ackedAt = atCaptor.getValue();
        assertThat(untilCaptor.getValue()).isEqualTo(ackedAt.plusSeconds(RESULT_TIMEOUT));
    }

    @Test
    void complete_typedKey_openOrFailedRowMarkedDoneWithTtlExpiry() {
        // setup
        when(repository.markDone(eq(DELIVERY_ID), eq(DeliveryStatus.COMPLETABLE), atCaptor.capture(), untilCaptor.capture())).thenReturn(true);

        // execution
        tracker.complete(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID);

        // verifications
        Instant finishedAt = atCaptor.getValue();
        assertThat(untilCaptor.getValue()).isEqualTo(finishedAt.plusSeconds(TTL));
    }

    @Test
    void cancel_typedKey_openRowMarkedCancelledWithTtlExpiry() {
        // setup
        when(repository.markCancelled(eq(DELIVERY_ID), eq(DeliveryStatus.OPEN), atCaptor.capture(), untilCaptor.capture())).thenReturn(true);

        // execution
        tracker.cancel(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID);

        // verifications
        Instant finishedAt = atCaptor.getValue();
        assertThat(untilCaptor.getValue()).isEqualTo(finishedAt.plusSeconds(TTL));
    }

    @Test
    void wake_machineId_unackedRowsOfThatMachineWoken() {
        // setup
        when(repository.wake(eq(MACHINE_ID), eq(DeliveryStatus.UNACKED), any(Instant.class))).thenReturn(TWO_ROWS);

        // execution
        tracker.wake(MACHINE_ID);

        // verifications
        verify(repository).wake(eq(MACHINE_ID), eq(DeliveryStatus.UNACKED), any(Instant.class));
    }
}
