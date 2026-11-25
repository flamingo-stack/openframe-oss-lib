package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareSchedulePackageInput;
import com.openframe.api.dto.rmm.software.UpdateSoftwareScheduleInput;
import com.openframe.api.service.rmm.schedule.ScheduleDeviceChange;
import com.openframe.audit.AuditRecorder;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceCriteria;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleMachineAssigned;
import com.openframe.data.document.rmm.schedule.SoftwareSchedulePackage;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.ScheduleMutationTransaction;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import com.openframe.publishing.transaction.MongoTransactionRunner.Transaction;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static com.openframe.data.document.audit.AuditAction.SOFTWARE_SCHEDULE_DEVICES_SET;
import static com.openframe.data.document.audit.AuditOutcome.SUCCESS;
import static com.openframe.data.document.packagesearch.PackageManagerType.WINGET;
import static com.openframe.data.document.rmm.schedule.ScheduleDeviceSelectionMode.CRITERIA;
import static com.openframe.data.document.rmm.schedule.ScheduleDeviceSelectionMode.SPECIFIC;
import static com.openframe.data.document.rmm.software.SoftwareAction.INSTALL;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareScheduleServiceDevicesTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String SCHEDULE_ID = "65f4a8000000000000000001";
    private static final String ACTOR = "user-1";
    private static final ScheduleDeviceCriteria RULE = ScheduleDeviceCriteria.builder()
            .organizationIds(List.of("org-1")).build();

    @Mock private SoftwareScheduleRepository scheduleRepository;
    @Mock private SoftwareScheduleMachineAssignedRepository assignedRepository;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private PackageManagerAvailability packageManagerAvailability;
    @Mock private SoftwarePackageSelectionResolver softwarePackageSelectionResolver;
    @Mock private MachineRepository machineRepository;
    @Mock private ScheduleMutationTransaction scheduleTransaction;
    @Mock private AuditRecorder auditRecorder;
    @InjectMocks private SoftwareScheduleService service;
    @Captor private ArgumentCaptor<SoftwareSchedule> scheduleCaptor;
    @Captor private ArgumentCaptor<List<SoftwareScheduleMachineAssigned>> rowsCaptor;
    @Captor private ArgumentCaptor<AuditEntry> entryCaptor;

    @Test
    void setDevices_specificSchedule_reportsTheDevicesAddedAndRemovedAgainstTheAssignedOnes() {
        storedSchedule();
        devicesManaged("m2", "m3");
        assigned("m1", "m2");

        ScheduleDeviceChange change = service.setDevices(SCHEDULE_ID, List.of("m2", "m3"), ACTOR);

        assertThat(change).isEqualTo(new ScheduleDeviceChange(List.of("m3"), List.of("m1"), false));
        assignedReadBeforeTheReplace();
    }

    @Test
    void setDevices_criteriaSchedule_switchesToSpecificAndReportsTheSwitch() {
        storedCriteriaSchedule();
        devicesManaged("m1");
        assigned();

        ScheduleDeviceChange change = service.setDevices(SCHEDULE_ID, List.of("m1"), ACTOR);

        assertThat(change).isEqualTo(new ScheduleDeviceChange(List.of("m1"), List.of(), true));
        verify(scheduleRepository).save(scheduleCaptor.capture());
        assertThat(scheduleCaptor.getValue())
                .extracting(SoftwareSchedule::getSelectionMode, SoftwareSchedule::getDeviceCriteria)
                .containsExactly(SPECIFIC, null);
    }

    @Test
    void setDevices_noMachineIds_reportsEveryAssignedDeviceRemoved() {
        storedSchedule();
        assigned("m1", "m2");

        ScheduleDeviceChange change = service.setDevices(SCHEDULE_ID, null, ACTOR);

        assertThat(change).isEqualTo(new ScheduleDeviceChange(List.of(), List.of("m1", "m2"), false));
    }

    @Test
    void setDevices_deviceWithoutPackageManager_keepsTheRuleAndTheDevices() {
        SoftwareSchedule schedule = storedCriteriaSchedule();
        transactionRuns();
        m9HasNoPackageManager();

        assertThatThrownBy(() -> service.setDevices(SCHEDULE_ID, List.of("m9"), ACTOR))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("These devices have no supported package manager: [m9]");
        verify(scheduleRepository, never()).save(schedule);
        verifyNoInteractions(assignedRepository);
    }

    @Test
    void addDevices_someAlreadyAssignedOrRepeated_savesAndReportsOnlyTheNewOnes() {
        storedSchedule();
        devicesManaged("m1", "m2");
        assigned("m1");

        ScheduleDeviceChange change = service.addDevices(SCHEDULE_ID, List.of("m1", "m2", "m2"), ACTOR);

        assertThat(change).isEqualTo(new ScheduleDeviceChange(List.of("m2"), List.of(), false));
        verify(assignedRepository).saveAll(rowsCaptor.capture());
        assertThat(rowsCaptor.getValue()).extracting(SoftwareScheduleMachineAssigned::getMachineId)
                .containsExactly("m2");
    }

    @Test
    void addDevices_allAlreadyAssigned_savesNothingAndReportsNoChange() {
        storedSchedule();
        devicesManaged("m1");
        assigned("m1");

        ScheduleDeviceChange change = service.addDevices(SCHEDULE_ID, List.of("m1"), ACTOR);

        assertThat(change).isEqualTo(new ScheduleDeviceChange(List.of(), List.of(), false));
        verify(assignedRepository, never()).saveAll(any());
    }

    @Test
    void addDevices_criteriaScheduleWithTheDeviceStillAssigned_reportsTheSwitch() {
        storedCriteriaSchedule();
        devicesManaged("m1");
        assigned("m1");

        ScheduleDeviceChange change = service.addDevices(SCHEDULE_ID, List.of("m1"), ACTOR);

        assertThat(change).isEqualTo(new ScheduleDeviceChange(List.of(), List.of(), true));
    }

    @Test
    void addDevices_noMachineIds_keepsTheRuleAndReportsNoChange() {
        SoftwareSchedule schedule = storedCriteriaSchedule();

        ScheduleDeviceChange change = service.addDevices(SCHEDULE_ID, List.of(), ACTOR);

        assertThat(change).isEqualTo(new ScheduleDeviceChange(List.of(), List.of(), false));
        verify(scheduleRepository, never()).save(schedule);
    }

    @Test
    void addDevices_deviceWithoutPackageManager_addsNothing() {
        storedSchedule();
        transactionRuns();
        m9HasNoPackageManager();

        assertThatThrownBy(() -> service.addDevices(SCHEDULE_ID, List.of("m9"), ACTOR))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("These devices have no supported package manager: [m9]");
        verifyNoInteractions(assignedRepository);
    }

    @Test
    void removeDevices_mixOfAssignedUnassignedAndRepeated_reportsOnlyTheAssignedOnce() {
        storedSchedule();
        assigned("m1", "m2");

        List<String> removed = service.removeDevices(SCHEDULE_ID, List.of("m1", "m3", "m1"), ACTOR);

        assertThat(removed).containsExactly("m1");
        verify(assignedRepository).deleteByTenantIdAndSoftwareScheduleIdAndMachineIdIn(
                TENANT_ID, SCHEDULE_ID, List.of("m1", "m3", "m1"));
    }

    @Test
    void update_devicesChanged_recordsTheAddedAndRemovedDevices() {
        storedScheduleSavedAsIs();
        devicesManaged("m2", "m3");
        assigned("m1", "m2");

        service.update(updateInput(List.of("m2", "m3")), ACTOR);

        verify(auditRecorder).record(entryCaptor.capture());
        assertThat(entryCaptor.getValue())
                .extracting(AuditEntry::getAction, AuditEntry::getOutcome, AuditEntry::getTargetId,
                        AuditEntry::getDetails)
                .containsExactly(SOFTWARE_SCHEDULE_DEVICES_SET, SUCCESS, SCHEDULE_ID,
                        Map.of("added", List.of("m3"), "removed", List.of("m1")));
        assignedReadBeforeTheReplace();
    }

    @Test
    void update_devicesUnchanged_recordsNoDeviceEvent() {
        storedScheduleSavedAsIs();
        devicesManaged("m1", "m2");
        assigned("m1", "m2");

        service.update(updateInput(List.of("m1", "m2")), ACTOR);

        verifyNoInteractions(auditRecorder);
    }

    private SoftwareSchedule storedSchedule() {
        return stored(schedule().build());
    }

    private SoftwareSchedule storedCriteriaSchedule() {
        return stored(schedule().selectionMode(CRITERIA).deviceCriteria(RULE).build());
    }

    private void storedScheduleSavedAsIs() {
        SoftwareSchedule schedule = storedSchedule();
        when(scheduleRepository.save(schedule)).thenReturn(schedule);
    }

    private SoftwareSchedule stored(SoftwareSchedule schedule) {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(schedule));
        return schedule;
    }

    private static SoftwareSchedule.SoftwareScheduleBuilder schedule() {
        return SoftwareSchedule.builder()
                .id(SCHEDULE_ID).tenantId(TENANT_ID).name("Nightly Slack").action(INSTALL)
                .packages(List.of(SoftwareSchedulePackage.builder()
                        .packageManager(WINGET).packageName("SlackTechnologies.Slack").build()));
    }

    private void transactionRuns() {
        when(scheduleTransaction.run(any())).thenAnswer(invocation -> invocation.<Transaction<?>>getArgument(0).execute());
    }

    private void devicesManaged(String... machineIds) {
        transactionRuns();
        when(machineRepository.findOnPrimaryByTenantIdAndMachineIdIn(TENANT_ID, Set.of(machineIds)))
                .thenReturn(Arrays.stream(machineIds).map(SoftwareScheduleServiceDevicesTest::managedMachine).toList());
        when(machineRepository.reserveForSoftwareAssignments(TENANT_ID, Set.of(machineIds), DeviceStatus.CONNECTED))
                .thenReturn((long) machineIds.length);
    }

    private static Machine managedMachine(String machineId) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        machine.setStatus(DeviceStatus.MANAGED);
        return machine;
    }

    private void assigned(String... machineIds) {
        when(assignedRepository.findOnPrimaryByTenantIdAndSoftwareScheduleId(TENANT_ID, SCHEDULE_ID))
                .thenReturn(Arrays.stream(machineIds)
                        .map(machineId -> SoftwareScheduleMachineAssigned.builder()
                                .tenantId(TENANT_ID).softwareScheduleId(SCHEDULE_ID).machineId(machineId).build())
                        .toList());
    }

    private void m9HasNoPackageManager() {
        doThrow(new BadRequestException("These devices have no supported package manager: [m9]"))
                .when(packageManagerAvailability).requireSoftwareManageable(List.of("m9"), List.of(WINGET));
    }

    private void assignedReadBeforeTheReplace() {
        InOrder inOrder = inOrder(assignedRepository);
        inOrder.verify(assignedRepository).findOnPrimaryByTenantIdAndSoftwareScheduleId(TENANT_ID, SCHEDULE_ID);
        inOrder.verify(assignedRepository).deleteByTenantIdAndSoftwareScheduleId(TENANT_ID, SCHEDULE_ID);
    }

    private static UpdateSoftwareScheduleInput updateInput(List<String> machineIds) {
        SoftwareSchedulePackageInput slack = new SoftwareSchedulePackageInput();
        slack.setPackageManager(WINGET);
        slack.setPackageName("SlackTechnologies.Slack");
        UpdateSoftwareScheduleInput input = new UpdateSoftwareScheduleInput();
        input.setId(SCHEDULE_ID);
        input.setName("Nightly Slack");
        input.setAction(INSTALL);
        input.setPackages(List.of(slack));
        input.setStartAt(Instant.parse("2026-09-16T03:30:00Z"));
        input.setMachineIds(machineIds);
        return input;
    }
}
