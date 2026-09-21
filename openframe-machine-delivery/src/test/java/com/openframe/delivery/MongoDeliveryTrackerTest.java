package com.openframe.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static com.openframe.delivery.DeliveryTestPolicies.TTL;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MongoDeliveryTrackerTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String TARGET_ID = "fleetmdm-agent";
    private static final String DELIVERY_ID = DeliveryId.of(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID);
    private static final long TWO_ROWS = 2L;

    @Mock private MachineDeliveryRepository repository;

    @Captor private ArgumentCaptor<Instant> finishedAtCaptor;
    @Captor private ArgumentCaptor<Instant> expiresAtCaptor;

    private MongoDeliveryTracker tracker;

    @BeforeEach
    void setUp() {
        tracker = new MongoDeliveryTracker(repository, DeliveryTestPolicies.properties());
    }

    @Test
    void acknowledge_typedKey_pendingRowMarkedAckedByCompositeId() {
        // setup
        when(repository.markAcked(eq(DELIVERY_ID), any(Instant.class))).thenReturn(true);

        // execution
        tracker.acknowledge(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID);

        // verifications
        verify(repository).markAcked(eq(DELIVERY_ID), any(Instant.class));
    }

    @Test
    void complete_typedKey_openRowMarkedDoneWithTtlExpiry() {
        // setup
        when(repository.markDone(eq(DELIVERY_ID), finishedAtCaptor.capture(), expiresAtCaptor.capture())).thenReturn(true);

        // execution
        tracker.complete(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID);

        // verifications
        Instant finishedAt = finishedAtCaptor.getValue();
        assertThat(expiresAtCaptor.getValue()).isEqualTo(finishedAt.plusSeconds(TTL));
    }

    @Test
    void cancel_typedKey_openRowMarkedCancelledWithTtlExpiry() {
        // setup
        when(repository.markCancelled(eq(DELIVERY_ID), finishedAtCaptor.capture(), expiresAtCaptor.capture())).thenReturn(true);

        // execution
        tracker.cancel(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID);

        // verifications
        Instant finishedAt = finishedAtCaptor.getValue();
        assertThat(expiresAtCaptor.getValue()).isEqualTo(finishedAt.plusSeconds(TTL));
    }

    @Test
    void wake_machineId_parkedRowsOfThatMachineWoken() {
        // setup
        when(repository.wake(eq(MACHINE_ID), any(Instant.class))).thenReturn(TWO_ROWS);

        // execution
        tracker.wake(MACHINE_ID);

        // verifications
        verify(repository).wake(eq(MACHINE_ID), any(Instant.class));
    }
}
