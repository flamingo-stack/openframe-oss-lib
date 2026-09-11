package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.CreateSoftwareScheduleInput;
import com.openframe.api.dto.rmm.software.SoftwareSchedulePackageInput;
import com.openframe.api.dto.rmm.software.SoftwareScheduleResponse;
import com.openframe.api.dto.rmm.software.UpdateSoftwareScheduleInput;
import com.openframe.api.service.rmm.software.SoftwareScheduleService;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.schedule.ScheduleTimeReference;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleMachineAssigned;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.repository.rmm.SoftwareScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SoftwareScheduleServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String SCHEDULE_ID = "65f4a8000000000000000001";
    private static final String ACTOR = "andrii@flamingo.cx";
    private static final List<ScriptStatus> UNIQUE_STATUSES =
            List.of(ScriptStatus.ACTIVE, ScriptStatus.ARCHIVED);

    private SoftwareScheduleRepository scheduleRepository;
    private SoftwareScheduleMachineAssignedRepository assignedRepository;
    private TenantIdProvider tenantIdProvider;
    private SoftwareScheduleService service;

    private CreateSoftwareScheduleInput createInput;

    @BeforeEach
    void setUp() {
        scheduleRepository = mock(SoftwareScheduleRepository.class);
        assignedRepository = mock(SoftwareScheduleMachineAssignedRepository.class);
        tenantIdProvider = mock(TenantIdProvider.class);
        service = new SoftwareScheduleService(scheduleRepository, assignedRepository, tenantIdProvider);

        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        // Saves are identity so assertions can read back what the service built.
        when(scheduleRepository.save(any(SoftwareSchedule.class))).thenAnswer(inv -> {
            SoftwareSchedule s = inv.getArgument(0);
            if (s.getId() == null) {
                s.setId(SCHEDULE_ID);
            }
            return s;
        });

        createInput = new CreateSoftwareScheduleInput();
        createInput.setName("Nightly Slack");
        createInput.setAction(SoftwareAction.INSTALL);
        createInput.setPackages(List.of(pkg(PackageManagerType.BREW, "slack", BrewPackageType.CASK)));
        createInput.setStartAt(Instant.parse("2026-09-15T02:00:00Z"));
        createInput.setMachineIds(List.of("m1", "m2"));
    }

    private static SoftwareSchedulePackageInput pkg(PackageManagerType manager, String name, BrewPackageType type) {
        SoftwareSchedulePackageInput p = new SoftwareSchedulePackageInput();
        p.setPackageManager(manager);
        p.setPackageName(name);
        p.setBrewPackageType(type);
        return p;
    }

    @Test
    @DisplayName("create: SERVER schedule seeds nextRunAt=startAt and persists device assignments")
    void createServerSeedsNextRunAtAndAssignsDevices() {
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(TENANT_ID, "Nightly Slack", UNIQUE_STATUSES))
                .thenReturn(false);

        SoftwareScheduleResponse response = service.create(createInput, ACTOR);

        ArgumentCaptor<SoftwareSchedule> captor = ArgumentCaptor.forClass(SoftwareSchedule.class);
        verify(scheduleRepository).save(captor.capture());
        SoftwareSchedule saved = captor.getValue();
        assertThat(saved.getTenantId()).isEqualTo(TENANT_ID);
        assertThat(saved.getTimeReference()).isEqualTo(ScheduleTimeReference.SERVER);
        assertThat(saved.getNextRunAt()).isEqualTo(Instant.parse("2026-09-15T02:00:00Z"));
        assertThat(saved.getStatus()).isEqualTo(ScriptStatus.ACTIVE);
        assertThat(saved.getCreatedBy()).isEqualTo(ACTOR);
        assertThat(saved.getPackages()).singleElement()
                .satisfies(p -> {
                    assertThat(p.getPackageName()).isEqualTo("slack");
                    assertThat(p.getBrewPackageType()).isEqualTo(BrewPackageType.CASK);
                });
        assertThat(response.getId()).isEqualTo(SCHEDULE_ID);

        verify(assignedRepository).deleteByTenantIdAndSoftwareScheduleId(TENANT_ID, SCHEDULE_ID);
        ArgumentCaptor<List<SoftwareScheduleMachineAssigned>> rows = ArgumentCaptor.forClass(List.class);
        verify(assignedRepository).saveAll(rows.capture());
        assertThat(rows.getValue()).extracting(SoftwareScheduleMachineAssigned::getMachineId)
                .containsExactly("m1", "m2");
    }

    @Test
    @DisplayName("create: DEVICE_LOCAL leaves nextRunAt null (timezone-driven)")
    void createDeviceLocalNullNextRunAt() {
        createInput.setTimeReference(ScheduleTimeReference.DEVICE_LOCAL);

        service.create(createInput, ACTOR);

        ArgumentCaptor<SoftwareSchedule> captor = ArgumentCaptor.forClass(SoftwareSchedule.class);
        verify(scheduleRepository).save(captor.capture());
        assertThat(captor.getValue().getNextRunAt()).isNull();
        assertThat(captor.getValue().getTimeReference()).isEqualTo(ScheduleTimeReference.DEVICE_LOCAL);
    }

    @Test
    @DisplayName("create: duplicate name conflicts")
    void createDuplicateNameConflicts() {
        when(scheduleRepository.existsByTenantIdAndNameAndStatusIn(TENANT_ID, "Nightly Slack", UNIQUE_STATUSES))
                .thenReturn(true);

        assertThatThrownBy(() -> service.create(createInput, ACTOR))
                .isInstanceOf(ConflictException.class);
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("create: off-grid startAt is rejected")
    void createOffGridRejected() {
        createInput.setStartAt(Instant.parse("2026-09-15T02:07:00Z"));

        assertThatThrownBy(() -> service.create(createInput, ACTOR))
                .isInstanceOf(BadRequestException.class);
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("create: repeat that is not a whole slot is rejected")
    void createBadRepeatRejected() {
        createInput.setRepeat(1000L);

        assertThatThrownBy(() -> service.create(createInput, ACTOR))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("create: empty machineIds clears assignment without saving rows")
    void createNoDevices() {
        createInput.setMachineIds(List.of());

        service.create(createInput, ACTOR);

        verify(assignedRepository).deleteByTenantIdAndSoftwareScheduleId(TENANT_ID, SCHEDULE_ID);
        verify(assignedRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("update: null machineIds leaves the assignment untouched")
    void updateKeepsDevicesWhenMachineIdsNull() {
        SoftwareSchedule existing = existingActive();
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(existing));
        when(scheduleRepository.existsByTenantIdAndNameAndIdNotAndStatusIn(
                eq(TENANT_ID), anyString(), eq(SCHEDULE_ID), eq(UNIQUE_STATUSES))).thenReturn(false);

        UpdateSoftwareScheduleInput input = new UpdateSoftwareScheduleInput();
        input.setId(SCHEDULE_ID);
        input.setName("Renamed");
        input.setAction(SoftwareAction.UPDATE);
        input.setPackages(List.of(pkg(PackageManagerType.WINGET, "vscode", null)));
        input.setStartAt(Instant.parse("2026-09-16T03:30:00Z"));
        input.setMachineIds(null);

        service.update(input, ACTOR);

        verify(scheduleRepository).save(any(SoftwareSchedule.class));
        verify(assignedRepository, never()).deleteByTenantIdAndSoftwareScheduleId(anyString(), anyString());
        verify(assignedRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("delete: soft-deletes by flipping status to DELETED")
    void deleteSoftDeletes() {
        SoftwareSchedule existing = existingActive();
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(existing));

        String id = service.delete(SCHEDULE_ID);

        assertThat(id).isEqualTo(SCHEDULE_ID);
        assertThat(existing.getStatus()).isEqualTo(ScriptStatus.DELETED);
        verify(scheduleRepository).save(existing);
    }

    @Test
    @DisplayName("get: a soft-deleted schedule is invisible (NotFound)")
    void getDeletedThrows() {
        SoftwareSchedule deleted = existingActive();
        deleted.setStatus(ScriptStatus.DELETED);
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(deleted));

        assertThatThrownBy(() -> service.get(SCHEDULE_ID)).isInstanceOf(NotFoundException.class);
    }

    private static SoftwareSchedule existingActive() {
        return SoftwareSchedule.builder()
                .id(SCHEDULE_ID).tenantId(TENANT_ID).name("Nightly Slack")
                .action(SoftwareAction.INSTALL)
                .timeReference(ScheduleTimeReference.SERVER)
                .startAt(Instant.parse("2026-09-15T02:00:00Z"))
                .status(ScriptStatus.ACTIVE)
                .build();
    }
}
