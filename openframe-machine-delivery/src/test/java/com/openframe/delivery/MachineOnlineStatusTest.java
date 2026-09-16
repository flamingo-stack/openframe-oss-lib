package com.openframe.delivery;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
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

    @Mock private MachineRepository machineRepository;

    @InjectMocks private MachineOnlineStatus status;

    @Test
    void offline_mixedMachines_onlyOfflineIdsReturned() {
        // setup
        Machine offline = new Machine();
        offline.setMachineId(OFFLINE_ID);
        Set<String> asked = Set.of(ONLINE_ID, OFFLINE_ID);
        when(machineRepository.findByMachineIdInAndStatus(asked, DeviceStatus.OFFLINE)).thenReturn(List.of(offline));

        // execution
        Set<String> result = status.offline(asked);

        // verifications
        assertThat(result).containsExactly(OFFLINE_ID);
    }
}
