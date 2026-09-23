package com.openframe.client.service;

import com.openframe.client.service.rmm.SoftwareDeviceLocalScheduleService;
import com.openframe.client.service.rmm.SoftwareScheduleExecutionService;
import com.openframe.client.service.rmm.SoftwareScheduleFireDispatcher;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleOnlineDispatch;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import com.openframe.data.service.rmm.SoftwareScheduleTargetResolver;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SoftwareScheduleExecutionServiceTest {

    private static final String TENANT = "t-1";

    private final SoftwareScheduleRepository scheduleRepository = mock(SoftwareScheduleRepository.class);
    private final SoftwareScheduleTargetResolver targetResolver = mock(SoftwareScheduleTargetResolver.class);
    private final SoftwareScheduleFireDispatcher fireDispatcher = mock(SoftwareScheduleFireDispatcher.class);
    private final SoftwareDeviceLocalScheduleService deviceLocalScheduleService = mock(SoftwareDeviceLocalScheduleService.class);
    private final MachineRepository machineRepository = mock(MachineRepository.class);
    private final SoftwareScheduleOnlineDispatchRepository onlineDispatchRepository = mock(SoftwareScheduleOnlineDispatchRepository.class);

    private final SoftwareScheduleExecutionService service = new SoftwareScheduleExecutionService(
            scheduleRepository, targetResolver, fireDispatcher, deviceLocalScheduleService,
            machineRepository, onlineDispatchRepository);

    @Test
    @DisplayName("a due repeating schedule fires to its ONLINE targets and advances nextRunAt into the future")
    void runDue_firesOnlineAndAdvancesRepeat() {
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).status(ScriptStatus.ACTIVE)
                .repeat(3600L).nextRunAt(Instant.now().minusSeconds(30))
                .build();
        due(schedule);
        when(targetResolver.resolveMachineIds(schedule)).thenReturn(List.of("m-1", "m-2"));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m-1", DeviceStatus.ONLINE), machine("m-2", DeviceStatus.ONLINE)));

        service.runDueSchedules();

        verify(fireDispatcher).dispatch(eq(schedule), eq(List.of("m-1", "m-2")), any());
        ArgumentCaptor<SoftwareSchedule> saved = ArgumentCaptor.forClass(SoftwareSchedule.class);
        verify(scheduleRepository).save(saved.capture());
        assertThat(saved.getValue().getNextRunAt()).isAfter(Instant.now());
        assertThat(saved.getValue().getLastRunAt()).isNotNull();
    }

    @Test
    @DisplayName("a one-shot schedule fires its ONLINE device once and clears nextRunAt")
    void runDue_oneShotClearsNextRunAt() {
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).status(ScriptStatus.ACTIVE)
                .repeat(null).nextRunAt(Instant.now().minusSeconds(30))
                .build();
        due(schedule);
        when(targetResolver.resolveMachineIds(schedule)).thenReturn(List.of("m-1"));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m-1", DeviceStatus.ONLINE)));

        service.runDueSchedules();

        verify(fireDispatcher).dispatch(eq(schedule), eq(List.of("m-1")), any());
        ArgumentCaptor<SoftwareSchedule> saved = ArgumentCaptor.forClass(SoftwareSchedule.class);
        verify(scheduleRepository).save(saved.capture());
        assertThat(saved.getValue().getNextRunAt()).isNull();
    }

    @Test
    @DisplayName("RETRY_ON_RECONNECT: an offline target is not dispatched but armed for reconnect with an expiry")
    void runDue_offlineRetry_armsSentinel() {
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).status(ScriptStatus.ACTIVE)
                .repeat(null).nextRunAt(Instant.now().minusSeconds(30))
                .offlineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT).reconnectWindowSeconds(3600L)
                .build();
        due(schedule);
        when(targetResolver.resolveMachineIds(schedule)).thenReturn(List.of("m-off"));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m-off", DeviceStatus.OFFLINE)));
        when(onlineDispatchRepository.findByTenantIdAndMachineIdAndScheduleId(eq(TENANT), anyString(), eq("ss-1")))
                .thenReturn(Optional.empty());

        service.runDueSchedules();

        verify(fireDispatcher, never()).dispatch(any(), any(), any());
        ArgumentCaptor<SoftwareScheduleOnlineDispatch> sentinel = ArgumentCaptor.forClass(SoftwareScheduleOnlineDispatch.class);
        verify(onlineDispatchRepository).save(sentinel.capture());
        assertThat(sentinel.getValue().getMachineId()).isEqualTo("m-off");
        assertThat(sentinel.getValue().getScheduleId()).isEqualTo("ss-1");
        assertThat(sentinel.getValue().getStatus()).isEqualTo(DeviceOnlineDispatchStatus.NEW);
        assertThat(sentinel.getValue().getExpiresAt()).isNotNull();
    }

    @Test
    @DisplayName("SKIP (default): an offline target is neither dispatched nor armed")
    void runDue_offlineSkip_noArm() {
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).status(ScriptStatus.ACTIVE)
                .repeat(null).nextRunAt(Instant.now().minusSeconds(30))
                .offlineBehavior(ScheduleOfflineBehavior.SKIP)
                .build();
        due(schedule);
        when(targetResolver.resolveMachineIds(schedule)).thenReturn(List.of("m-off"));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m-off", DeviceStatus.OFFLINE)));

        service.runDueSchedules();

        verify(fireDispatcher, never()).dispatch(any(), any(), any());
        verify(onlineDispatchRepository, never()).save(any());
    }

    @Test
    @DisplayName("no due schedules → nothing fired or saved")
    void runDue_noneDue_noop() {
        when(scheduleRepository.findByStatusAndNextRunAtLessThanEqual(eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of());

        service.runDueSchedules();

        verify(fireDispatcher, never()).dispatch(any(), any(), any());
        verify(scheduleRepository, never()).save(any());
    }

    private void due(SoftwareSchedule schedule) {
        when(scheduleRepository.findByStatusAndNextRunAtLessThanEqual(eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of(schedule));
    }

    private static Machine machine(String machineId, DeviceStatus status) {
        Machine m = new Machine();
        m.setMachineId(machineId);
        m.setStatus(status);
        return m;
    }
}
