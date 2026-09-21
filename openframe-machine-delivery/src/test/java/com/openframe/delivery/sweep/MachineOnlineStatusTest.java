package com.openframe.delivery.sweep;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.delivery.sweep.MachineOnlineStatus.Lookup;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachineOnlineStatusTest {

    private static final String ONLINE_ID = "mach-1";
    private static final String OFFLINE_ID = "mach-2";
    private static final String DELETED_ID = "mach-3";
    private static final String MISSING_ID = "mach-4";
    private static final String NO_STATUS_ID = "mach-5";

    @Mock private MachineRepository machineRepository;

    @InjectMocks private MachineOnlineStatus status;

    @Test
    void lookup_onlineAndOfflineMachines_onlyOfflineReported() {
        // setup
        Set<String> asked = Set.of(ONLINE_ID, OFFLINE_ID);
        List<Machine> found = List.of(machine(ONLINE_ID, DeviceStatus.ONLINE), machine(OFFLINE_ID, DeviceStatus.OFFLINE));
        when(machineRepository.findByMachineIdIn(asked)).thenReturn(found);

        // execution
        Lookup lookup = status.lookup(asked);

        // verifications
        assertThat(lookup.isOffline(OFFLINE_ID)).isTrue();
        assertThat(lookup.isOffline(ONLINE_ID)).isFalse();
        assertThat(lookup.isGone(ONLINE_ID)).isFalse();
        assertThat(lookup.isGone(OFFLINE_ID)).isFalse();
    }

    @Test
    void lookup_deletedAndMissingMachines_bothGone() {
        // setup
        Set<String> asked = Set.of(DELETED_ID, MISSING_ID);
        List<Machine> found = List.of(machine(DELETED_ID, DeviceStatus.DELETED));
        when(machineRepository.findByMachineIdIn(asked)).thenReturn(found);

        // execution
        Lookup lookup = status.lookup(asked);

        // verifications
        assertThat(lookup.isGone(DELETED_ID)).isTrue();
        assertThat(lookup.isGone(MISSING_ID)).isTrue();
        assertThat(lookup.isOffline(DELETED_ID)).isFalse();
    }

    @Test
    void lookup_machineWithoutStatus_neitherOfflineNorGone() {
        // setup
        Set<String> asked = Set.of(NO_STATUS_ID);
        List<Machine> found = List.of(machine(NO_STATUS_ID, null));
        when(machineRepository.findByMachineIdIn(asked)).thenReturn(found);

        // execution
        Lookup lookup = status.lookup(asked);

        // verifications
        assertThat(lookup.isOffline(NO_STATUS_ID)).isFalse();
        assertThat(lookup.isGone(NO_STATUS_ID)).isFalse();
    }

    private static Machine machine(String machineId, DeviceStatus deviceStatus) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        machine.setStatus(deviceStatus);
        return machine;
    }
}
