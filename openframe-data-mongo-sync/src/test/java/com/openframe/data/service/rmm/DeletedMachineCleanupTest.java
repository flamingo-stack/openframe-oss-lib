package com.openframe.data.service.rmm;

import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.schedule.ScheduleScriptMachineAssigned;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.service.rmm.software.SoftwareProjectionTrigger;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.openframe.data.document.audit.AuditAction.SCRIPT_SCHEDULE_DEVICES_REMOVE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeletedMachineCleanupTest {

    @Mock private ScriptScheduleMachineAssignedRepository assignedRepository;
    @Mock private ScriptScheduleRepository scheduleRepository;
    @Mock private DeviceOnlineDispatchRepository onlineDeviceDispatchRepository;
    @Mock private DeviceSoftwareRepository deviceSoftwareRepository;
    @Mock private SoftwareProjectionTrigger projectionTrigger;

    @InjectMocks private DeletedMachineCleanup cleanup;

    @Test
    @DisplayName("deletes the machine's schedule assignments and first-online dispatch records")
    void removesAssignmentsAndDispatch() {
        cleanup.cleanUpDeletedMachine("t-1", "m-1");

        verify(assignedRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
        verify(onlineDeviceDispatchRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
    }

    @Test
    @DisplayName("a missing tenant or machine id touches nothing")
    void missingIds_noop() {
        cleanup.cleanUpDeletedMachine(null, "m-1");
        cleanup.cleanUpDeletedMachine("t-1", null);

        verifyNoInteractions(assignedRepository, onlineDeviceDispatchRepository,
                deviceSoftwareRepository, projectionTrigger);
    }

    @Test
    @DisplayName("drops the device's software rows and re-projects every title and CVE it touched")
    void removesSoftwareRowsAndReprojects() {
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t-1", "m-1")).thenReturn(List.of(
                DeviceSoftware.builder().machineId("m-1").softwareTitleId(42L)
                        .vulnerabilities(List.of("CVE-1", "CVE-2")).build(),
                DeviceSoftware.builder().machineId("m-1").softwareTitleId(99L)
                        .vulnerabilities(List.of("CVE-1")).build()));  // CVE-1 shared across titles

        cleanup.cleanUpDeletedMachine("t-1", "m-1");

        verify(deviceSoftwareRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
        verify(projectionTrigger).titlesChanged("t-1", Set.of(42L, 99L));
        verify(projectionTrigger).cvesChanged("t-1", Set.of("CVE-1", "CVE-2"));
    }

    @Test
    @DisplayName("no software rows: nothing is deleted or re-projected")
    void noSoftwareRows_noReprojection() {
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t-1", "m-1")).thenReturn(List.of());

        cleanup.cleanUpDeletedMachine("t-1", "m-1");

        verify(deviceSoftwareRepository).findByTenantIdAndMachineId("t-1", "m-1");
        verifyNoInteractions(projectionTrigger);
    }

    @Test
    void cleanUpDeletedMachine_deviceOnAScheduleThatListsDevices_reportsItsRemovalFromThatSchedule() {
        deviceIsOn(schedule(ScriptStatus.ARCHIVED, ScheduleDeviceSelectionMode.SPECIFIC));

        List<AuditEntry> removals = cleanup.cleanUpDeletedMachine("t-1", "m-1");

        assertThat(removals)
                .extracting(AuditEntry::getAction, AuditEntry::getOutcome, AuditEntry::getTargetId,
                        AuditEntry::getDetails)
                .containsExactly(tuple(SCRIPT_SCHEDULE_DEVICES_REMOVE, AuditOutcome.SUCCESS, "sch-1",
                        Map.of("machineIds", List.of("m-1"))));
    }

    @Test
    void cleanUpDeletedMachine_deviceOnADeletedSchedule_reportsNoRemoval() {
        deviceIsOn(schedule(ScriptStatus.DELETED, ScheduleDeviceSelectionMode.SPECIFIC));

        assertThat(cleanup.cleanUpDeletedMachine("t-1", "m-1")).isEmpty();
    }

    @Test
    void cleanUpDeletedMachine_scheduleSelectsDevicesByCriteria_reportsNoRemoval() {
        deviceIsOn(schedule(ScriptStatus.ACTIVE, ScheduleDeviceSelectionMode.CRITERIA));

        assertThat(cleanup.cleanUpDeletedMachine("t-1", "m-1")).isEmpty();
    }

    private void deviceIsOn(ScheduleScript schedule) {
        when(assignedRepository.findByTenantIdAndMachineId("t-1", "m-1")).thenReturn(List.of(
                ScheduleScriptMachineAssigned.builder().scriptScheduleId("sch-1").machineId("m-1").build()));
        when(scheduleRepository.findByTenantIdAndIdIn("t-1", List.of("sch-1"))).thenReturn(List.of(schedule));
    }

    private static ScheduleScript schedule(ScriptStatus status, ScheduleDeviceSelectionMode selectionMode) {
        return ScheduleScript.builder().id("sch-1").status(status).selectionMode(selectionMode).build();
    }
}
