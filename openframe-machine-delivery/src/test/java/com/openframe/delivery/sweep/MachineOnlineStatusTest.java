package com.openframe.delivery.sweep;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.delivery.config.DeliveryTestPolicies;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachineOnlineStatusTest {

    private static final String ONLINE_ID = "mach-1";
    private static final String LEAVING_ID = "mach-2";
    private static final String GONE_ID = "mach-3";
    private static final Set<String> ALL = Set.of(ONLINE_ID, LEAVING_ID, GONE_ID);

    @Mock private MachineRepository machineRepository;

    @Captor private ArgumentCaptor<Instant> lastSeenAfterCaptor;

    private MachineOnlineStatus status;

    @BeforeEach
    void setUp() {
        status = new MachineOnlineStatus(machineRepository, DeliveryTestPolicies.properties());
    }

    @Test
    void online_onlineMachinesAndPendingDeletionWithFreshHeartbeat_bothCounted() {
        // setup
        Instant before = Instant.now();
        long threshold = DeliveryTestPolicies.properties().getSweep().getOnlineThresholdSeconds();
        when(machineRepository.findByMachineIdInAndStatus(ALL, DeviceStatus.ONLINE)).thenReturn(List.of(machine(ONLINE_ID)));
        when(machineRepository.findByMachineIdInAndStatusAndLastSeenAfter(eq(ALL), eq(DeviceStatus.PENDING_DELETION), lastSeenAfterCaptor.capture()))
                .thenReturn(List.of(machine(LEAVING_ID)));

        // execution
        Set<String> online = status.online(ALL);

        // verifications
        assertThat(online).containsExactlyInAnyOrder(ONLINE_ID, LEAVING_ID);
        assertThat(lastSeenAfterCaptor.getValue())
                .isBetween(before.minusSeconds(threshold + 5), before.minusSeconds(threshold).plusSeconds(5));
    }

    @Test
    void gone_deletedArchivedDecommissioned_returned() {
        // setup
        when(machineRepository.findByMachineIdInAndStatusIn(eq(ALL), eq(Set.of(DeviceStatus.DELETED, DeviceStatus.ARCHIVED, DeviceStatus.DECOMMISSIONED))))
                .thenReturn(List.of(machine(GONE_ID)));

        // execution
        Set<String> gone = status.gone(ALL);

        // verifications
        assertThat(gone).containsExactly(GONE_ID);
    }

    private static Machine machine(String machineId) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        return machine;
    }
}
