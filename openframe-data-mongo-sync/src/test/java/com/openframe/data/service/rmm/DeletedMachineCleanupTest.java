package com.openframe.data.service.rmm;

import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsPendingUpdateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsStateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriteResult;
import com.openframe.data.service.machine.MachineWriter;
import com.openframe.data.service.rmm.software.SoftwareProjectionTrigger;
import com.openframe.publishing.transaction.MongoTransactionRunner;
import com.openframe.core.exception.ConflictException;
import org.bson.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.query.Criteria;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;

@ExtendWith(MockitoExtension.class)
class DeletedMachineCleanupTest {

    @Mock private ScriptScheduleMachineAssignedRepository assignedRepository;
    @Mock private SoftwareScheduleMachineAssignedRepository softwareAssignedRepository;
    @Mock private SoftwareScheduleOnlineDispatchRepository softwareOnlineDispatchRepository;
    @Mock private DeviceOnlineDispatchRepository onlineDeviceDispatchRepository;
    @Mock private DeviceSoftwareRepository deviceSoftwareRepository;
    @Mock private SoftwareProjectionTrigger projectionTrigger;
    @Mock private MachineWriter machineWriter;
    @Mock private ScheduleMutationTransaction scheduleTransaction;
    @Mock private DeviceOsStateRepository deviceOsStateRepository;
    @Mock private DeviceOsPendingUpdateRepository deviceOsPendingUpdateRepository;
    @Mock private DeviceOsUpdateHistoryRepository deviceOsUpdateHistoryRepository;

    @Captor private ArgumentCaptor<Criteria> guardCaptor;

    @InjectMocks private DeletedMachineCleanup cleanup;

    @Test
    @DisplayName("deletes the machine's schedule assignments, first-online dispatch records and OS update data")
    void removesAssignmentsAndDispatch() {
        // setup
        Machine machine = new Machine();
        machine.setTenantId("t-1");
        machine.setMachineId("m-1");
        machine.setStatus(DeviceStatus.MANAGED);
        when(scheduleTransaction.run(any())).thenAnswer(invocation -> {
            MongoTransactionRunner.Transaction<Machine> mutation = invocation.getArgument(0);
            return mutation.execute();
        });
        when(machineWriter.update(eq("m-1"), any(Criteria.class), any(MachineUpdate.class)))
                .thenReturn(Optional.of(new MachineWriteResult(machine, machine)));

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
                deviceOsStateRepository, deviceOsPendingUpdateRepository, deviceOsUpdateHistoryRepository);
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
    void cleanUpDeletedMachine_deviceThatNeverReportedItsOs_threeDeletesStillAsked() {
        // setup

        // execution
        cleanup.cleanUpDeletedMachine("t-1", "m-1");

        // verifications
        verify(deviceOsStateRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
        verify(deviceOsPendingUpdateRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
        verify(deviceOsUpdateHistoryRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
    }

    @Test
    void markDeleted_managedDevice_guardAcceptsEveryStoredNameOfManaged() {
        // setup
        Machine machine = machine(DeviceStatus.MANAGED);
        stubLifecycleWrite(machine);

        // execution
        cleanup.markDeleted(machine);

        // verifications
        Document guard = capturedGuard();
        assertThat(guard)
                .containsEntry("tenantId", "t-1")
                .containsEntry("enrollmentId", "enrollment-1");
        assertThat(statusIn(guard)).containsExactly("MANAGED", "ACTIVE", "OFFLINE", "ONLINE");
    }

    @Test
    void markDeleted_archivedDevice_guardAcceptsEveryStoredNameOfArchived() {
        // setup
        Machine machine = machine(DeviceStatus.ARCHIVED);
        stubLifecycleWrite(machine);

        // execution
        cleanup.markDeleted(machine);

        // verifications
        assertThat(statusIn(capturedGuard())).containsExactly("ARCHIVED", "DECOMMISSIONED", "INACTIVE", "MAINTENANCE");
    }

    @Test
    void markDeleted_pendingDevice_guardOnPendingOnly() {
        // setup
        Machine machine = machine(DeviceStatus.PENDING);
        stubLifecycleWrite(machine);

        // execution
        cleanup.markDeleted(machine);

        // verifications
        assertThat(statusIn(capturedGuard())).containsExactly("PENDING");
    }

    @Test
    void markDeleted_deviceWithoutStatus_guardMatchesAMissingStatus() {
        // setup
        Machine machine = machine(null);
        stubLifecycleWrite(machine);

        // execution
        cleanup.markDeleted(machine);

        // verifications
        assertThat(statusIn(capturedGuard())).containsExactly((Object) null);
    }

    @Test
    void reenrollDeleted_deletedDevice_guardOnDeletedOnly() {
        // setup
        Machine machine = machine(DeviceStatus.DELETED);
        stubLifecycleWrite(machine);
        MachineUpdate update = MachineUpdate.machineUpdate();

        // execution
        cleanup.reenrollDeleted(machine, update);

        // verifications
        assertThat(statusIn(capturedGuard())).containsExactly("DELETED");
    }

    @Test
    void markDeleted_statusChangedSinceTheRead_throwsConflict() {
        // setup
        Machine machine = machine(DeviceStatus.MANAGED);
        stubTransaction();
        when(machineWriter.update(eq("m-1"), any(Criteria.class), any(MachineUpdate.class))).thenReturn(Optional.empty());

        // execution
        ConflictException ex = assertThrows(ConflictException.class, () -> cleanup.markDeleted(machine));

        // verifications
        assertThat(ex.getMessage()).contains("m-1");
        verifyNoInteractions(assignedRepository, deviceOsStateRepository);
    }

    private static Machine machine(DeviceStatus status) {
        Machine machine = new Machine();
        machine.setTenantId("t-1");
        machine.setMachineId("m-1");
        machine.setEnrollmentId("enrollment-1");
        machine.setStatus(status);
        return machine;
    }

    private void stubTransaction() {
        when(scheduleTransaction.run(any())).thenAnswer(invocation -> {
            MongoTransactionRunner.Transaction<Machine> mutation = invocation.getArgument(0);
            return mutation.execute();
        });
    }

    private void stubLifecycleWrite(Machine machine) {
        stubTransaction();
        when(machineWriter.update(eq("m-1"), any(Criteria.class), any(MachineUpdate.class)))
                .thenReturn(Optional.of(new MachineWriteResult(machine, machine)));
    }

    private Document capturedGuard() {
        verify(machineWriter).update(eq("m-1"), guardCaptor.capture(), any(MachineUpdate.class));
        return guardCaptor.getValue().getCriteriaObject();
    }

    private static List<Object> statusIn(Document guard) {
        Collection<?> names = guard.get("status", Document.class).get("$in", Collection.class);
        return new ArrayList<>(names);
    }
}
