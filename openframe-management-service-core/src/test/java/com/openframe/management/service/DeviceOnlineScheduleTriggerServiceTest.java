package com.openframe.management.service;

import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.document.rmm.ScriptScheduleTrigger;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceOnlineScheduleTriggerServiceTest {

    private static final String TENANT = "tenant-1";
    private static final String MACHINE = "m-1";

    @Mock private ScriptScheduleMachineAssignedRepository assignedRepository;
    @Mock private ScriptScheduleRepository scheduleRepository;
    @Mock private ScheduleFireDispatcher fireDispatcher;

    @InjectMocks private DeviceOnlineScheduleTriggerService service;

    @Test
    @DisplayName("fires only ACTIVE + DEVICE_ONLINE schedules assigned to the machine, on that one machine")
    void firesActiveDeviceOnlineOnly() {
        when(assignedRepository.findByTenantIdAndMachineIdsContaining(TENANT, MACHINE))
                .thenReturn(List.of(assignment("s1"), assignment("s2"), assignment("s3")));
        ScriptSchedule deviceOnline = schedule("s1", ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE);
        ScriptSchedule wrongTrigger = schedule("s2", ScriptScheduleTrigger.DATE_TIME, ScriptStatus.ACTIVE);
        ScriptSchedule archived = schedule("s3", ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ARCHIVED);
        when(scheduleRepository.findByTenantIdAndIdIn(eq(TENANT), any()))
                .thenReturn(List.of(deviceOnline, wrongTrigger, archived));

        service.onDeviceOnline(TENANT, MACHINE);

        verify(fireDispatcher).dispatch(eq(deviceOnline), eq(List.of(MACHINE)), any(Instant.class));
        verify(fireDispatcher, never()).dispatch(eq(wrongTrigger), any(), any(Instant.class));
        verify(fireDispatcher, never()).dispatch(eq(archived), any(), any(Instant.class));
    }

    @Test
    @DisplayName("no assignment for the machine → no schedule load, no dispatch")
    void noAssignment_noOp() {
        when(assignedRepository.findByTenantIdAndMachineIdsContaining(TENANT, MACHINE))
                .thenReturn(List.of());

        service.onDeviceOnline(TENANT, MACHINE);

        verifyNoInteractions(scheduleRepository, fireDispatcher);
    }

    @Test
    @DisplayName("assigned but no DEVICE_ONLINE schedule → nothing fired")
    void assignedButNoDeviceOnline_noDispatch() {
        when(assignedRepository.findByTenantIdAndMachineIdsContaining(TENANT, MACHINE))
                .thenReturn(List.of(assignment("s1")));
        when(scheduleRepository.findByTenantIdAndIdIn(eq(TENANT), any()))
                .thenReturn(List.of(schedule("s1", ScriptScheduleTrigger.DATE_TIME, ScriptStatus.ACTIVE)));

        service.onDeviceOnline(TENANT, MACHINE);

        verify(fireDispatcher, never()).dispatch(any(), any(), any(Instant.class));
    }

    @Test
    @DisplayName("one broken schedule does not stop the others from firing")
    void errorIsolation() {
        when(assignedRepository.findByTenantIdAndMachineIdsContaining(TENANT, MACHINE))
                .thenReturn(List.of(assignment("s1"), assignment("s2")));
        ScriptSchedule broken = schedule("s1", ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE);
        ScriptSchedule ok = schedule("s2", ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE);
        when(scheduleRepository.findByTenantIdAndIdIn(eq(TENANT), any())).thenReturn(List.of(broken, ok));
        doThrow(new RuntimeException("nats down")).when(fireDispatcher)
                .dispatch(eq(broken), eq(List.of(MACHINE)), any(Instant.class));

        service.onDeviceOnline(TENANT, MACHINE);

        verify(fireDispatcher).dispatch(eq(ok), eq(List.of(MACHINE)), any(Instant.class));
    }

    private static ScriptScheduleMachineAssigned assignment(String scheduleId) {
        return ScriptScheduleMachineAssigned.builder()
                .tenantId(TENANT).scriptScheduleId(scheduleId).machineIds(List.of(MACHINE)).build();
    }

    private static ScriptSchedule schedule(String id, ScriptScheduleTrigger trigger, ScriptStatus status) {
        return ScriptSchedule.builder()
                .id(id).tenantId(TENANT).name(id).trigger(trigger).status(status)
                .scriptIds(List.of("sc")).build();
    }
}
