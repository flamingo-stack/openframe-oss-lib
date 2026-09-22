package com.openframe.delivery.sweep;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachineOnlineStatusTest {

    private static final String ONLINE_ID = "mach-1";
    private static final String OFFLINE_ID = "mach-2";
    private static final String DELETED_ID = "mach-3";
    private static final Set<DeviceStatus> GONE = EnumSet.of(
            DeviceStatus.DELETED, DeviceStatus.ARCHIVED, DeviceStatus.DECOMMISSIONED);

    @Mock private MachineRepository machineRepository;

    @InjectMocks private MachineOnlineStatus status;

    @Test
    void online_mixedMachines_onlyOnlineIdsReturned() {
        // setup
        Set<String> asked = Set.of(ONLINE_ID, OFFLINE_ID);
        List<Machine> found = List.of(machine(ONLINE_ID));
        when(machineRepository.findByMachineIdInAndStatus(asked, DeviceStatus.ONLINE)).thenReturn(found);

        // execution
        Set<String> online = status.online(asked);

        // verifications
        assertThat(online).containsExactly(ONLINE_ID);
    }

    @Test
    void gone_mixedMachines_onlyRemovedIdsReturned() {
        // setup
        Set<String> asked = Set.of(ONLINE_ID, DELETED_ID);
        List<Machine> found = List.of(machine(DELETED_ID));
        when(machineRepository.findByMachineIdInAndStatusIn(asked, GONE)).thenReturn(found);

        // execution
        Set<String> gone = status.gone(asked);

        // verifications
        assertThat(gone).containsExactly(DELETED_ID);
    }

    private static Machine machine(String machineId) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        return machine;
    }
}
