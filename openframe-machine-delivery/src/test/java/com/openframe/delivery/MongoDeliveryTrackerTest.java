package com.openframe.delivery;

import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static com.openframe.delivery.DeliveryTestPolicies.TTL;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MongoDeliveryTrackerTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String TARGET_ID = "tactical-agent";
    private static final String DELIVERY_ID = DeliveryId.of(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID);

    @Mock private MachineDeliveryRepository repository;

    private MongoDeliveryTracker tracker;

    private MachineDelivery delivery;

    @BeforeEach
    void setUp() {
        delivery = MachineDelivery.builder()
                .id(DELIVERY_ID)
                .type(DeliveryType.TOOL_INSTALLATION)
                .targetId(TARGET_ID)
                .machineId(MACHINE_ID)
                .status(DeliveryStatus.PENDING)
                .build();
        tracker = new MongoDeliveryTracker(repository, DeliveryTestPolicies.properties());
    }

    @Test
    void acknowledge_pendingRow_ackedWithTimestamp() {
        // setup
        when(repository.findById(DELIVERY_ID)).thenReturn(Optional.of(delivery));

        // execution
        tracker.acknowledge(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID);

        // verifications
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.ACKED);
        assertThat(delivery.getAckedAt()).isNotNull();
        verify(repository).save(delivery);
    }

    @Test
    void acknowledge_alreadyAcked_untouched() {
        // setup
        delivery.setStatus(DeliveryStatus.ACKED);
        when(repository.findById(DELIVERY_ID)).thenReturn(Optional.of(delivery));

        // execution
        tracker.acknowledge(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID);

        // verifications
        verify(repository, never()).save(delivery);
    }

    @Test
    void acknowledge_unknownRow_noop() {
        // setup
        when(repository.findById(DELIVERY_ID)).thenReturn(Optional.empty());

        // execution
        tracker.acknowledge(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID);

        // verifications
        verify(repository, never()).save(delivery);
    }

    @Test
    void complete_ackedRow_doneWithExpiry() {
        // setup
        delivery.setStatus(DeliveryStatus.ACKED);
        when(repository.findById(DELIVERY_ID)).thenReturn(Optional.of(delivery));

        // execution
        tracker.complete(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID);

        // verifications
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.DONE);
        assertThat(delivery.getFinishedAt()).isNotNull();
        assertThat(delivery.getExpiresAt()).isEqualTo(delivery.getFinishedAt().plusSeconds(TTL));
        verify(repository).save(delivery);
    }

    @Test
    void complete_failedRow_untouched() {
        // setup
        delivery.setStatus(DeliveryStatus.FAILED);
        when(repository.findById(DELIVERY_ID)).thenReturn(Optional.of(delivery));

        // execution
        tracker.complete(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID);

        // verifications
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.FAILED);
        verify(repository, never()).save(delivery);
    }
}
