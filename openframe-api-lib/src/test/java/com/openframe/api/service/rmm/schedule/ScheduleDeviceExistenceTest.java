package com.openframe.api.service.rmm.schedule;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScheduleDeviceExistenceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";

    @Mock private ScriptScheduleMachineAssignedRepository assignedRepository;
    @Mock private MachineRepository machineRepository;
    @Mock private TenantIdProvider tenantIdProvider;

    @InjectMocks private ScheduleScriptDeviceService service;

    @Test
    void requireExistingDevices_offlineDevice_passesWithoutAssignmentChanges() {
        // setup
        Machine machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setStatus(DeviceStatus.OFFLINE);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(machineRepository.findByTenantIdAndMachineIdIn(TENANT_ID, Set.of(MACHINE_ID))).thenReturn(List.of(machine));
        List<String> machineIds = List.of(MACHINE_ID);

        // execution
        Throwable failure = catchThrowable(() -> service.requireExistingDevices(machineIds));

        // verifications
        assertThat(failure).isNull();
        verifyNoInteractions(assignedRepository);
    }

    @Test
    void requireExistingDevices_missingDevice_rejectsWithoutAssignmentChanges() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        List<String> machineIds = List.of(MACHINE_ID);

        // execution
        Throwable failure = catchThrowable(() -> service.requireExistingDevices(machineIds));

        // verifications
        assertThat(failure).isInstanceOf(BadRequestException.class).hasMessageContaining(MACHINE_ID);
        verifyNoInteractions(assignedRepository);
    }
}
