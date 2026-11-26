package com.openframe.data.service.rmm;

import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTarget;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTargetType;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.schedule.ScheduleScriptMachineAssigned;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleMachineAssigned;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsPendingUpdateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsStateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateRolloutStateRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdateOverrideRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdatePolicyRepository;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriteResult;
import com.openframe.data.service.machine.MachineWriter;
import com.openframe.data.service.rmm.DeletedMachineCleanup.LifecycleChange;
import com.openframe.data.service.rmm.software.SoftwareProjectionTrigger;
import com.openframe.publishing.transaction.MongoTransactionRunner;
import org.assertj.core.groups.Tuple;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.query.Criteria;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static com.openframe.data.document.audit.AuditAction.SCRIPT_SCHEDULE_DEVICES_REMOVE;
import static com.openframe.data.document.audit.AuditAction.SOFTWARE_SCHEDULE_DEVICES_REMOVE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;

@ExtendWith(MockitoExtension.class)
class DeletedMachineCleanupTest {

    @Mock private ScriptScheduleMachineAssignedRepository assignedRepository;
    @Mock private ScriptScheduleRepository scheduleRepository;
    @Mock private SoftwareScheduleMachineAssignedRepository softwareAssignedRepository;
    @Mock private SoftwareScheduleRepository softwareScheduleRepository;
    @Mock private SoftwareScheduleOnlineDispatchRepository softwareOnlineDispatchRepository;
    @Mock private DeviceOnlineDispatchRepository onlineDeviceDispatchRepository;
    @Mock private DeviceSoftwareRepository deviceSoftwareRepository;
    @Mock private SoftwareProjectionTrigger projectionTrigger;
    @Mock private MachineWriter machineWriter;
    @Mock private ScheduleMutationTransaction scheduleTransaction;
    @Mock private DeviceOsStateRepository deviceOsStateRepository;
    @Mock private DeviceOsPendingUpdateRepository deviceOsPendingUpdateRepository;
    @Mock private DeviceOsUpdateHistoryRepository deviceOsUpdateHistoryRepository;
    @Mock private DeviceOsUpdateRolloutStateRepository deviceOsUpdateRolloutStateRepository;
    @Mock private OsUpdateOverrideRepository osUpdateOverrideRepository;
    @Mock private OsUpdatePolicyRepository osUpdatePolicyRepository;

    @InjectMocks private DeletedMachineCleanup cleanup;

    @Test
    @DisplayName("deletes the machine's schedule assignments, first-online dispatch records and OS update data")
    void removesAssignmentsAndDispatch() {
        // setup
        Machine machine = machineBeingDeleted();

        // execution
        cleanup.markDeleted(machine);

        // verifications
        verify(assignedRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
        verify(softwareAssignedRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
        verify(softwareOnlineDispatchRepository).deleteByTenantIdAndMachineIdAndStatus("t-1", "m-1", DeviceOnlineDispatchStatus.NEW);
        verify(onlineDeviceDispatchRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
        verify(deviceOsStateRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
        verify(deviceOsPendingUpdateRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
        verify(deviceOsUpdateHistoryRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
    }

    @Test
    @DisplayName("a missing tenant or machine id touches nothing")
    void missingIds_noop() {
        cleanup.cleanUpDeletedMachine(null, "m-1");
        cleanup.cleanUpDeletedMachine("t-1", null);

        verifyNoInteractions(assignedRepository, softwareAssignedRepository, softwareOnlineDispatchRepository,
                onlineDeviceDispatchRepository, deviceSoftwareRepository, projectionTrigger,
                deviceOsStateRepository, deviceOsPendingUpdateRepository, deviceOsUpdateHistoryRepository,
                deviceOsUpdateRolloutStateRepository, osUpdateOverrideRepository, osUpdatePolicyRepository);
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
    void markDeleted_deviceOnAScriptScheduleThatListsDevices_reportsItsRemovalFromThatSchedule() {
        Machine machine = machineBeingDeleted();
        deviceIsOn(schedule(ScriptStatus.ARCHIVED, ScheduleDeviceSelectionMode.SPECIFIC));

        LifecycleChange deleted = cleanup.markDeleted(machine);

        assertThat(deleted.machine()).isSameAs(machine);
        assertThat(deleted.scheduleRemovals())
                .extracting(AuditEntry::getAction, AuditEntry::getOutcome, AuditEntry::getTargetId,
                        AuditEntry::getDetails)
                .containsExactly(removalOf(SCRIPT_SCHEDULE_DEVICES_REMOVE, "sch-1"));
    }

    @Test
    void markDeleted_deviceOnADeletedScriptSchedule_reportsNoRemoval() {
        Machine machine = machineBeingDeleted();
        deviceIsOn(schedule(ScriptStatus.DELETED, ScheduleDeviceSelectionMode.SPECIFIC));

        assertThat(cleanup.markDeleted(machine).scheduleRemovals()).isEmpty();
    }

    @Test
    void markDeleted_scriptScheduleSelectsDevicesByCriteria_reportsNoRemoval() {
        Machine machine = machineBeingDeleted();
        deviceIsOn(schedule(ScriptStatus.ACTIVE, ScheduleDeviceSelectionMode.CRITERIA));

        assertThat(cleanup.markDeleted(machine).scheduleRemovals()).isEmpty();
    }

    @Test
    void markDeleted_deviceOnASoftwareScheduleThatListsDevices_reportsItsRemovalFromThatSchedule() {
        Machine machine = machineBeingDeleted();
        deviceIsOn(softwareSchedule(ScriptStatus.ACTIVE, ScheduleDeviceSelectionMode.SPECIFIC));

        assertThat(cleanup.markDeleted(machine).scheduleRemovals())
                .extracting(AuditEntry::getAction, AuditEntry::getOutcome, AuditEntry::getTargetId,
                        AuditEntry::getDetails)
                .containsExactly(removalOf(SOFTWARE_SCHEDULE_DEVICES_REMOVE, "soft-1"));
    }

    @Test
    void markDeleted_deviceOnADeletedSoftwareSchedule_reportsNoRemoval() {
        Machine machine = machineBeingDeleted();
        deviceIsOn(softwareSchedule(ScriptStatus.DELETED, ScheduleDeviceSelectionMode.SPECIFIC));

        assertThat(cleanup.markDeleted(machine).scheduleRemovals()).isEmpty();
    }

    @Test
    void markDeleted_softwareScheduleSelectsDevicesByCriteria_reportsNoRemoval() {
        Machine machine = machineBeingDeleted();
        deviceIsOn(softwareSchedule(ScriptStatus.ACTIVE, ScheduleDeviceSelectionMode.CRITERIA));

        assertThat(cleanup.markDeleted(machine).scheduleRemovals()).isEmpty();
    }

    @Test
    void markDeleted_deviceOnSchedulesOfBothKinds_reportsTheScriptRemovalThenTheSoftwareRemoval() {
        Machine machine = machineBeingDeleted();
        deviceIsOn(schedule(ScriptStatus.ACTIVE, ScheduleDeviceSelectionMode.SPECIFIC));
        deviceIsOn(softwareSchedule(ScriptStatus.ARCHIVED, ScheduleDeviceSelectionMode.SPECIFIC));

        assertThat(cleanup.markDeleted(machine).scheduleRemovals())
                .extracting(AuditEntry::getAction, AuditEntry::getOutcome, AuditEntry::getTargetId,
                        AuditEntry::getDetails)
                .containsExactly(removalOf(SCRIPT_SCHEDULE_DEVICES_REMOVE, "sch-1"),
                        removalOf(SOFTWARE_SCHEDULE_DEVICES_REMOVE, "soft-1"));
    }

    private Machine machineBeingDeleted() {
        Machine machine = new Machine();
        machine.setTenantId("t-1");
        machine.setMachineId("m-1");
        machine.setStatus(DeviceStatus.MANAGED);
        when(scheduleTransaction.run(any())).thenAnswer(invocation -> {
            MongoTransactionRunner.Transaction<LifecycleChange> mutation = invocation.getArgument(0);
            return mutation.execute();
        });
        when(machineWriter.update(eq("m-1"), any(Criteria.class), any(MachineUpdate.class)))
                .thenReturn(Optional.of(new MachineWriteResult(machine, machine)));
        return machine;
    }

    private void deviceIsOn(ScheduleScript schedule) {
        when(assignedRepository.findByTenantIdAndMachineId("t-1", "m-1")).thenReturn(List.of(
                ScheduleScriptMachineAssigned.builder().scriptScheduleId("sch-1").machineId("m-1").build()));
        when(scheduleRepository.findByTenantIdAndIdIn("t-1", List.of("sch-1"))).thenReturn(List.of(schedule));
    }

    private void deviceIsOn(SoftwareSchedule schedule) {
        when(softwareAssignedRepository.findByTenantIdAndMachineId("t-1", "m-1")).thenReturn(List.of(
                SoftwareScheduleMachineAssigned.builder().softwareScheduleId("soft-1").machineId("m-1").build()));
        when(softwareScheduleRepository.findByTenantIdAndIdIn("t-1", List.of("soft-1"))).thenReturn(List.of(schedule));
    }

    private static ScheduleScript schedule(ScriptStatus status, ScheduleDeviceSelectionMode selectionMode) {
        return ScheduleScript.builder().id("sch-1").status(status).selectionMode(selectionMode).build();
    }

    private static SoftwareSchedule softwareSchedule(ScriptStatus status, ScheduleDeviceSelectionMode selectionMode) {
        return SoftwareSchedule.builder().id("soft-1").status(status).selectionMode(selectionMode).build();
    }

    private static Tuple removalOf(AuditAction action, String scheduleId) {
        return tuple(action, AuditOutcome.SUCCESS, scheduleId, Map.of("machineIds", List.of("m-1")));
    }

    @Test
    void cleanUpDeletedMachine_deviceWithOsReport_stateAndPendingUpdatesAndHistoryOfThatDeviceRemoved() {
        // setup
        when(deviceOsStateRepository.deleteByTenantIdAndMachineId("t-1", "m-1")).thenReturn(1L);
        when(deviceOsPendingUpdateRepository.deleteByTenantIdAndMachineId("t-1", "m-1")).thenReturn(3L);
        when(deviceOsUpdateHistoryRepository.deleteByTenantIdAndMachineId("t-1", "m-1")).thenReturn(7L);

        // execution
        cleanup.cleanUpDeletedMachine("t-1", "m-1");

        // verifications
        verify(deviceOsStateRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
        verify(deviceOsPendingUpdateRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
        verify(deviceOsUpdateHistoryRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
    }

    @Test
    void cleanUpDeletedMachine_deviceWithRolloutStates_rolloutStatesOfThatDeviceRemoved() {
        // setup

        // execution
        cleanup.cleanUpDeletedMachine("t-1", "m-1");

        // verifications
        verify(deviceOsUpdateRolloutStateRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
    }

    @Test
    void cleanUpDeletedMachine_deviceWithOverrides_overridesOfThatDeviceRemoved() {
        // execution
        cleanup.cleanUpDeletedMachine("t-1", "m-1");

        // verifications
        verify(osUpdateOverrideRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
    }

    @Test
    void cleanUpDeletedMachine_deviceNamedByDevicePolicies_takenOutOfThemAndAPolicyLeftWithoutDevicesStays() {
        // setup
        OsUpdatePolicy ofTwoDevices = OsUpdatePolicy.builder().id("policy-1").target(OsUpdatePolicyTarget.builder()
                .type(OsUpdatePolicyTargetType.DEVICE).machineIds(List.of("m-1", "m-2")).build()).build();
        OsUpdatePolicy ofThisDevice = OsUpdatePolicy.builder().id("policy-2").target(OsUpdatePolicyTarget.builder()
                .type(OsUpdatePolicyTargetType.DEVICE).machineIds(List.of("m-1")).build()).build();
        when(osUpdatePolicyRepository.findByTenantIdAndTargetMachineIdsContaining("t-1", "m-1"))
                .thenReturn(List.of(ofTwoDevices, ofThisDevice));

        // execution
        cleanup.cleanUpDeletedMachine("t-1", "m-1");

        // verifications
        verify(osUpdatePolicyRepository).saveAll(List.of(ofTwoDevices, ofThisDevice));
        assertThat(ofTwoDevices.getTarget().getMachineIds()).containsExactly("m-2");
        assertThat(ofThisDevice.getTarget().getMachineIds()).isEmpty();
    }

    @Test
    void cleanUpDeletedMachine_deviceThatNeverReportedItsOs_threeDeletesStillAsked() {
        // setup

        // execution
        cleanup.cleanUpDeletedMachine("t-1", "m-1");

        // verifications
        verify(deviceOsStateRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
        verify(deviceOsPendingUpdateRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
        verify(deviceOsUpdateHistoryRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
    }
}
