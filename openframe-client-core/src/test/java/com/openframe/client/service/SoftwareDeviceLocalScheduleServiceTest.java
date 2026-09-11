package com.openframe.client.service;

import com.openframe.client.service.rmm.SoftwareDeviceLocalScheduleService;
import com.openframe.client.service.rmm.SoftwareScheduleFireDispatcher;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceLocalTimeDispatchStatus;
import com.openframe.data.document.rmm.schedule.ScheduleLocalMachineTimeDispatch;
import com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger;
import com.openframe.data.document.rmm.schedule.ScheduleTimeReference;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleMachineAssigned;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.nats.publisher.MachineTimezoneRequestNatsPublisher;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScheduleDeviceLocalDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SoftwareDeviceLocalScheduleServiceTest {

    private static final String TENANT = "t-1";
    private static final String SCHEDULE_ID = "ss-1";

    private final SoftwareScheduleRepository scheduleRepository = mock(SoftwareScheduleRepository.class);
    private final SoftwareScheduleMachineAssignedRepository assignedRepository = mock(SoftwareScheduleMachineAssignedRepository.class);
    private final MachineRepository machineRepository = mock(MachineRepository.class);
    private final ScheduleDeviceLocalDispatchRepository dispatchRepository = mock(ScheduleDeviceLocalDispatchRepository.class);
    private final SoftwareScheduleFireDispatcher fireDispatcher = mock(SoftwareScheduleFireDispatcher.class);
    private final MachineTimezoneRequestNatsPublisher timezoneRequestPublisher = mock(MachineTimezoneRequestNatsPublisher.class);

    private final SoftwareDeviceLocalScheduleService service = new SoftwareDeviceLocalScheduleService(
            scheduleRepository, assignedRepository, machineRepository, dispatchRepository, fireDispatcher, timezoneRequestPublisher);

    {
        ReflectionTestUtils.setField(service, "catchupSeconds", 1800L);
    }

    @Test
    @DisplayName("online device whose local time has arrived within the window → fires software + records FIRED + requests a fresh timezone")
    void online_dueWithinWindow_fires() {
        Instant now = Instant.now();
        SoftwareSchedule schedule = deviceLocalSchedule(now.minusSeconds(60));
        given(schedule, machine("m-1", DeviceStatus.ONLINE, "UTC"));

        service.runDueDeviceLocalSchedules(now);

        verify(timezoneRequestPublisher).request("m-1", SCHEDULE_ID);
        verify(fireDispatcher).dispatch(eq(schedule), eq(List.of("m-1")), eq(now));
        ArgumentCaptor<ScheduleLocalMachineTimeDispatch> sentinel = ArgumentCaptor.forClass(ScheduleLocalMachineTimeDispatch.class);
        verify(dispatchRepository).save(sentinel.capture());
        assertThat(sentinel.getValue().getStatus()).isEqualTo(ScheduleDeviceLocalTimeDispatchStatus.FIRED);
    }

    @Test
    @DisplayName("online device with no reported timezone yet → requests it and defers (no fire, no sentinel)")
    void online_noTimezone_defers() {
        Instant now = Instant.now();
        given(deviceLocalSchedule(now.minusSeconds(60)), machine("m-1", DeviceStatus.ONLINE, null));

        service.runDueDeviceLocalSchedules(now);

        verify(timezoneRequestPublisher).request("m-1", SCHEDULE_ID);
        verify(fireDispatcher, never()).dispatch(any(), anyList(), any());
        verify(dispatchRepository, never()).save(any());
    }

    @Test
    @DisplayName("offline device whose local fire window has passed → MISSED, nothing dispatched")
    void offline_pastWindow_missed() {
        Instant now = Instant.now();
        given(deviceLocalSchedule(now.minusSeconds(3000)), machine("m-1", DeviceStatus.OFFLINE, "UTC"));

        service.runDueDeviceLocalSchedules(now);

        verify(fireDispatcher, never()).dispatch(any(), anyList(), any());
        ArgumentCaptor<ScheduleLocalMachineTimeDispatch> sentinel = ArgumentCaptor.forClass(ScheduleLocalMachineTimeDispatch.class);
        verify(dispatchRepository).save(sentinel.capture());
        assertThat(sentinel.getValue().getStatus()).isEqualTo(ScheduleDeviceLocalTimeDispatchStatus.MISSED);
    }

    private void given(SoftwareSchedule schedule, Machine machine) {
        when(scheduleRepository.findByStatusAndTriggerAndTimeReference(
                ScriptStatus.ACTIVE, ScheduleScriptTrigger.DATE_TIME, ScheduleTimeReference.DEVICE_LOCAL))
                .thenReturn(List.of(schedule));
        when(assignedRepository.findByTenantIdAndSoftwareScheduleId(TENANT, SCHEDULE_ID))
                .thenReturn(List.of(SoftwareScheduleMachineAssigned.builder()
                        .tenantId(TENANT).softwareScheduleId(SCHEDULE_ID).machineId(machine.getMachineId()).build()));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any())).thenReturn(List.of(machine));
        when(dispatchRepository.findByScheduleIdAndMachineIdIn(eq(SCHEDULE_ID), any())).thenReturn(List.of());
    }

    private static SoftwareSchedule deviceLocalSchedule(Instant startAt) {
        return SoftwareSchedule.builder()
                .id(SCHEDULE_ID).tenantId(TENANT).status(ScriptStatus.ACTIVE)
                .trigger(ScheduleScriptTrigger.DATE_TIME).timeReference(ScheduleTimeReference.DEVICE_LOCAL)
                .action(SoftwareAction.INSTALL).startAt(startAt).createdBy("u")
                .build();
    }

    private static Machine machine(String machineId, DeviceStatus status, String timezone) {
        Machine m = new Machine();
        m.setMachineId(machineId);
        m.setStatus(status);
        m.setTimezone(timezone);
        return m;
    }
}
