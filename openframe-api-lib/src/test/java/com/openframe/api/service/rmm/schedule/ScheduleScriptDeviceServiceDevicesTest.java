package com.openframe.api.service.rmm.schedule;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.schedule.ScheduleScriptMachineAssigned;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.ScheduleDeviceTargetResolver;
import com.openframe.data.service.rmm.ScheduleMutationTransaction;
import com.openframe.publishing.transaction.MongoTransactionRunner.Transaction;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static com.openframe.data.document.rmm.schedule.ScheduleDeviceSelectionMode.CRITERIA;
import static com.openframe.data.document.rmm.schedule.ScheduleDeviceSelectionMode.SPECIFIC;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScheduleScriptDeviceServiceDevicesTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String SCHEDULE_ID = "schedule-1";

    @Mock private ScriptScheduleMachineAssignedRepository assignedRepository;
    @Mock private ScriptScheduleRepository scheduleRepository;
    @Mock private MachineRepository machineRepository;
    @Mock private ScheduleDeviceTargetResolver targetResolver;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private DeviceOnlineDispatchRepository onlineDeviceDispatchRepository;
    @Mock private ScheduleDeliveryRefresher deliveryRefresher;
    @Mock private ScheduleMutationTransaction scheduleTransaction;
    @InjectMocks private ScheduleScriptDeviceService deviceService;

    @Test
    void setDevices_devicesAddedAndRemoved_reportsTheDifference() {
        scheduleIn(SPECIFIC);
        devicesExist("m-1", "m-3");
        assigned("m-1", "m-2");

        ScheduleDeviceChange change = deviceService.setDevices(SCHEDULE_ID, List.of("m-1", "m-3"), "user-1");

        assertThat(change).isEqualTo(new ScheduleDeviceChange(List.of("m-3"), List.of("m-2"), false));
    }

    @Test
    void setDevices_criteriaSchedule_reportsTheSwitch() {
        scheduleIn(CRITERIA);
        assigned();

        ScheduleDeviceChange change = deviceService.setDevices(SCHEDULE_ID, List.of(), "user-1");

        assertThat(change).isEqualTo(new ScheduleDeviceChange(List.of(), List.of(), true));
    }

    @Test
    void addDevices_someAlreadyAssigned_reportsOnlyTheNewOnes() {
        scheduleIn(SPECIFIC);
        devicesExist("m-1", "m-2");
        assigned("m-1");

        ScheduleDeviceChange change = deviceService.addDevices(SCHEDULE_ID, List.of("m-1", "m-2"), "user-1");

        assertThat(change).isEqualTo(new ScheduleDeviceChange(List.of("m-2"), List.of(), false));
    }

    @Test
    void removeDevices_someNotAssigned_reportsOnlyTheAssignedOnes() {
        scheduleListsDevices();
        assigned("m-1", "m-2");

        List<String> removed = deviceService.removeDevices(SCHEDULE_ID, List.of("m-2", "m-3"), "user-1");

        assertThat(removed).containsExactly("m-2");
    }

    @Test
    void removeDevices_sameDeviceTwice_reportsItOnce() {
        scheduleListsDevices();
        assigned("m-1");

        List<String> removed = deviceService.removeDevices(SCHEDULE_ID, List.of("m-1", "m-1"), "user-1");

        assertThat(removed).containsExactly("m-1");
    }

    private void scheduleListsDevices() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(scheduleTransaction.run(any())).thenAnswer(invocation -> invocation.<Transaction<?>>getArgument(0).execute());
        when(scheduleRepository.markSpecificAssignmentChange(TENANT_ID, SCHEDULE_ID, ScriptStatus.DELETED, CRITERIA))
                .thenReturn(1L);
    }

    private void scheduleIn(ScheduleDeviceSelectionMode mode) {
        ScheduleScript schedule = ScheduleScript.builder().id(SCHEDULE_ID).selectionMode(mode).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(schedule));
    }

    private void devicesExist(String... machineIds) {
        when(machineRepository.findByTenantIdAndMachineIdIn(TENANT_ID, Set.of(machineIds)))
                .thenReturn(Arrays.stream(machineIds).map(ScheduleScriptDeviceServiceDevicesTest::onlineMachine).toList());
    }

    private void assigned(String... machineIds) {
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT_ID, SCHEDULE_ID))
                .thenReturn(Arrays.stream(machineIds).map(ScheduleScriptDeviceServiceDevicesTest::assignment).toList());
    }

    private static Machine onlineMachine(String machineId) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        machine.setStatus(DeviceStatus.ONLINE);
        return machine;
    }

    private static ScheduleScriptMachineAssigned assignment(String machineId) {
        return ScheduleScriptMachineAssigned.builder().machineId(machineId).build();
    }
}
