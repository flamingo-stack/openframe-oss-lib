package com.openframe.client.listener;

import com.openframe.client.event.DeviceCameOnlineEvent;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.DeviceFirstOnlineDispatch;
import com.openframe.data.document.rmm.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleTrigger;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.rmm.ScheduleDeviceTargetResolver;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceOnlineCriteriaArmingListenerTest {

    private static final String TENANT = "tenant-1";
    private static final String MACHINE = "machine-1";
    private static final String SCHEDULE = "sched-1";

    @Mock private ScriptScheduleRepository scheduleRepository;
    @Mock private ScheduleDeviceTargetResolver targetResolver;
    @Mock private DeviceOnlineDispatchRepository dispatchRepository;

    @InjectMocks private DeviceOnlineCriteriaArmingListener listener;

    private static Machine machine() {
        Machine m = new Machine();
        m.setTenantId(TENANT);
        m.setMachineId(MACHINE);
        return m;
    }

    private static ScriptSchedule schedule() {
        return ScriptSchedule.builder().id(SCHEDULE).tenantId(TENANT).build();
    }

    private DeviceCameOnlineEvent event() {
        return new DeviceCameOnlineEvent(this, machine());
    }

    @Test
    @DisplayName("criteria matches + no sentinel yet → arms a NEW sentinel for (tenant, machine, schedule)")
    void armsSentinel_whenCriteriaMatchesAndNoneExists() {
        ScriptSchedule schedule = schedule();
        when(scheduleRepository.findByTenantIdAndTriggerAndStatus(TENANT, ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE))
                .thenReturn(List.of(schedule));
        when(targetResolver.matchesCriteria(eq(schedule), any(Machine.class))).thenReturn(true);
        when(dispatchRepository.findByTenantIdAndMachineIdAndScheduleId(TENANT, MACHINE, SCHEDULE))
                .thenReturn(Optional.empty());

        listener.onDeviceCameOnline(event());

        ArgumentCaptor<DeviceFirstOnlineDispatch> captor = ArgumentCaptor.forClass(DeviceFirstOnlineDispatch.class);
        verify(dispatchRepository).save(captor.capture());
        DeviceFirstOnlineDispatch armed = captor.getValue();
        assertThat(armed.getTenantId()).isEqualTo(TENANT);
        assertThat(armed.getMachineId()).isEqualTo(MACHINE);
        assertThat(armed.getScheduleId()).isEqualTo(SCHEDULE);
        assertThat(armed.getStatus()).isEqualTo(DeviceOnlineDispatchStatus.NEW);
    }

    @Test
    @DisplayName("fire-once: a sentinel already exists for (schedule, device) → does NOT re-arm")
    void doesNotArm_whenSentinelAlreadyExists() {
        ScriptSchedule schedule = schedule();
        when(scheduleRepository.findByTenantIdAndTriggerAndStatus(TENANT, ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE))
                .thenReturn(List.of(schedule));
        when(targetResolver.matchesCriteria(eq(schedule), any(Machine.class))).thenReturn(true);
        when(dispatchRepository.findByTenantIdAndMachineIdAndScheduleId(TENANT, MACHINE, SCHEDULE))
                .thenReturn(Optional.of(DeviceFirstOnlineDispatch.builder()
                        .tenantId(TENANT).machineId(MACHINE).scheduleId(SCHEDULE)
                        .status(DeviceOnlineDispatchStatus.PROCESSED).build()));

        listener.onDeviceCameOnline(event());

        verify(dispatchRepository, never()).save(any());
    }

    @Test
    @DisplayName("device does not match the criteria → nothing armed, existence not even checked")
    void doesNotArm_whenCriteriaDoesNotMatch() {
        ScriptSchedule schedule = schedule();
        when(scheduleRepository.findByTenantIdAndTriggerAndStatus(TENANT, ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE))
                .thenReturn(List.of(schedule));
        when(targetResolver.matchesCriteria(eq(schedule), any(Machine.class))).thenReturn(false);

        listener.onDeviceCameOnline(event());

        verify(dispatchRepository, never()).findByTenantIdAndMachineIdAndScheduleId(any(), any(), any());
        verify(dispatchRepository, never()).save(any());
    }

    @Test
    @DisplayName("event with a null machine → no lookups, no writes")
    void ignoresEvent_whenMachineNull() {
        listener.onDeviceCameOnline(new DeviceCameOnlineEvent(this, null));

        verifyNoInteractions(scheduleRepository, targetResolver, dispatchRepository);
    }
}
