package com.openframe.client.service.rmm.delivery;

import com.openframe.client.service.rmm.delivery.DeliveryProperties.Policy;
import com.openframe.data.document.rmm.delivery.DeliveryKind;
import com.openframe.data.document.rmm.delivery.DeliveryStatus;
import com.openframe.data.document.rmm.delivery.MachineDelivery;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.repository.rmm.MachineDeliveryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MongoDeliveryTrackerTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String TOOL_AGENT_ID = "tactical-agent";
    private static final String DELIVERY_ID = MachineDelivery.id(DeliveryKind.TOOL_INSTALLATION, TOOL_AGENT_ID, MACHINE_ID);
    private static final long TTL = 604_800L;

    @Mock private MachineDeliveryRepository repository;

    private MongoDeliveryTracker tracker;

    private MachineDelivery delivery;

    @BeforeEach
    void setUp() {
        Policy defaults = new Policy();
        defaults.setAckThresholdSeconds(30L);
        defaults.setMaxAttempts(3);
        defaults.setOfflineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT);
        defaults.setReconnectWindowSeconds(86_400L);
        defaults.setResultTimeoutSeconds(600L);
        defaults.setTtlSeconds(TTL);
        DeliveryProperties properties = new DeliveryProperties();
        properties.setDefaults(defaults);

        delivery = MachineDelivery.builder()
                .id(DELIVERY_ID)
                .kind(DeliveryKind.TOOL_INSTALLATION)
                .targetId(TOOL_AGENT_ID)
                .machineId(MACHINE_ID)
                .status(DeliveryStatus.PENDING)
                .build();

        tracker = new MongoDeliveryTracker(repository, properties);
    }

    @Test
    void acknowledge_pendingRow_ackedWithTimestamp() {
        // setup
        when(repository.findById(DELIVERY_ID)).thenReturn(Optional.of(delivery));

        // execution
        tracker.acknowledge(DeliveryKind.TOOL_INSTALLATION, TOOL_AGENT_ID, MACHINE_ID);

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
        tracker.acknowledge(DeliveryKind.TOOL_INSTALLATION, TOOL_AGENT_ID, MACHINE_ID);

        // verifications
        verify(repository, never()).save(delivery);
    }

    @Test
    void acknowledge_unknownRow_noop() {
        // setup
        when(repository.findById(DELIVERY_ID)).thenReturn(Optional.empty());

        // execution
        tracker.acknowledge(DeliveryKind.TOOL_INSTALLATION, TOOL_AGENT_ID, MACHINE_ID);

        // verifications
        verify(repository, never()).save(delivery);
    }

    @Test
    void complete_ackedRow_doneWithExpiry() {
        // setup
        delivery.setStatus(DeliveryStatus.ACKED);
        when(repository.findById(DELIVERY_ID)).thenReturn(Optional.of(delivery));

        // execution
        tracker.complete(DeliveryKind.TOOL_INSTALLATION, TOOL_AGENT_ID, MACHINE_ID);

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
        tracker.complete(DeliveryKind.TOOL_INSTALLATION, TOOL_AGENT_ID, MACHINE_ID);

        // verifications
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.FAILED);
        verify(repository, never()).save(delivery);
    }
}
