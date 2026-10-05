package com.openframe.delivery.sweep;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.repository.device.MachineRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachineOnlineStatusTest {

    private static final String ONLINE_ID = "mach-1";
    private static final String LEAVING_ID = "mach-2";
    private static final String UNKNOWN_ID = "mach-3";
    private static final Set<String> ALL = Set.of(ONLINE_ID, LEAVING_ID, UNKNOWN_ID);

    @Mock private MachineRepository machineRepository;

    @InjectMocks private MachineOnlineStatus status;

    @Test
    void online_machinesTalkingToUs_returned() {
        // setup
        when(machineRepository.findByMachineIdInAndTelemetryStatus(ALL, TelemetryStatus.ONLINE))
                .thenReturn(List.of(machine(ONLINE_ID, DeviceStatus.PENDING_DELETION)));

        // execution
        Set<String> online = status.online(ALL);

        // verifications
        assertThat(online).containsExactly(ONLINE_ID);
    }

    @Test
    void statuses_knownMachines_mappedUnknownAbsent() {
        // setup
        when(machineRepository.findByMachineIdIn(ALL)).thenReturn(List.of(machine(ONLINE_ID, DeviceStatus.ONLINE), machine(LEAVING_ID, DeviceStatus.PENDING_DELETION)));

        // execution
        Map<String, DeviceStatus> statuses = status.statuses(ALL);

        // verifications
        assertThat(statuses).containsOnly(Map.entry(ONLINE_ID, DeviceStatus.ONLINE), Map.entry(LEAVING_ID, DeviceStatus.PENDING_DELETION));
    }

    private static Machine machine(String machineId, DeviceStatus deviceStatus) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        machine.setStatus(deviceStatus);
        return machine;
    }
}
