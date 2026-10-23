package com.openframe.data.service.rmm;

import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class DeletedMachineCleanupTest {

    @Mock private ScriptScheduleMachineAssignedRepository assignedRepository;
    @Mock private DeviceOnlineDispatchRepository onlineDeviceDispatchRepository;

    @InjectMocks private DeletedMachineCleanup cleanup;

    @Test
    @DisplayName("removeFromSchedules: deletes the machine's schedule assignments and first-online dispatch records")
    void removesAssignmentsAndDispatch() {
        cleanup.removeFromSchedules("t-1", "m-1");

        verify(assignedRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
        verify(onlineDeviceDispatchRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
    }

    @Test
    @DisplayName("removeFromSchedules: a missing tenant or machine id touches nothing")
    void missingIds_noop() {
        cleanup.removeFromSchedules(null, "m-1");
        cleanup.removeFromSchedules("t-1", null);

        verifyNoInteractions(assignedRepository, onlineDeviceDispatchRepository);
    }
}
