package com.openframe.api.service.rmm;

import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
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

/**
 * Unit tests for {@link ScriptScheduleDeviceService}. All collaborators are
 * interfaces, so they mock cleanly; the assignment document logic is verified
 * against captured saves.
 */
class ScriptScheduleDeviceServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String SCHEDULE_ID = "sch-1";

    private ScriptScheduleMachineAssignedRepository assignedRepository;
    private ScriptScheduleRepository scheduleRepository;
    private ScriptScheduleDeviceService service;

    @BeforeEach
    void setUp() {
        assignedRepository = mock(ScriptScheduleMachineAssignedRepository.class);
        scheduleRepository = mock(ScriptScheduleRepository.class);
        TenantIdProvider tenantIdProvider = mock(TenantIdProvider.class);
        service = new ScriptScheduleDeviceService(assignedRepository, scheduleRepository, tenantIdProvider);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
    }

    private void scheduleExists(ScriptStatus status) {
        scheduleExistsReturning(status);
    }

    private ScriptSchedule scheduleExistsReturning(ScriptStatus status) {
        ScriptSchedule schedule = ScriptSchedule.builder().id(SCHEDULE_ID).status(status).build();
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(schedule));
        return schedule;
    }

    @Test
    @DisplayName("setDevices: creates a one-schedule assignment doc (deduped, createdBy stamped) when none exists")
    void setDevices_whenNoAssignment_createsDoc() {
        scheduleExists(ScriptStatus.ACTIVE);
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT_ID, SCHEDULE_ID))
                .thenReturn(Optional.empty());
        when(assignedRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.setDevices(SCHEDULE_ID, List.of("m-1", "m-2", "m-1"), "user-1");

        ArgumentCaptor<ScriptScheduleMachineAssigned> captor = ArgumentCaptor.forClass(ScriptScheduleMachineAssigned.class);
        verify(assignedRepository).save(captor.capture());
        ScriptScheduleMachineAssigned saved = captor.getValue();
        assertThat(saved.getTenantId()).isEqualTo(TENANT_ID);
        assertThat(saved.getScriptScheduleId()).isEqualTo(SCHEDULE_ID);
        assertThat(saved.getMachineIds()).containsExactly("m-1", "m-2");   // deduped, order preserved
        assertThat(saved.getCreatedBy()).isEqualTo("user-1");
    }

    @Test
    @DisplayName("setDevices: replaces the machine set on the existing doc (PUT), does not create a new one")
    void setDevices_whenAssignmentExists_replacesMachines() {
        scheduleExists(ScriptStatus.ACTIVE);
        ScriptScheduleMachineAssigned existing = ScriptScheduleMachineAssigned.builder()
                .id("assign-1").tenantId(TENANT_ID)
                .scriptScheduleId(SCHEDULE_ID)
                .machineIds(List.of("old-1", "old-2"))
                .createdBy("user-1")
                .build();
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT_ID, SCHEDULE_ID))
                .thenReturn(Optional.of(existing));
        when(assignedRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.setDevices(SCHEDULE_ID, List.of("new-1"), "user-2");

        assertThat(existing.getMachineIds()).containsExactly("new-1");
        verify(assignedRepository).save(existing);
    }

    @Test
    @DisplayName("setDevices: an empty machine list clears the assignment")
    void setDevices_emptyList_clears() {
        scheduleExists(ScriptStatus.ACTIVE);
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT_ID, SCHEDULE_ID))
                .thenReturn(Optional.empty());
        when(assignedRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.setDevices(SCHEDULE_ID, List.of(), "user-1");

        ArgumentCaptor<ScriptScheduleMachineAssigned> captor = ArgumentCaptor.forClass(ScriptScheduleMachineAssigned.class);
        verify(assignedRepository).save(captor.capture());
        assertThat(captor.getValue().getMachineIds()).isEmpty();
    }

    @Test
    @DisplayName("setDevices: throws NotFoundException when the schedule does not exist")
    void setDevices_whenScheduleMissing_throws() {
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.setDevices(SCHEDULE_ID, List.of("m-1"), "user-1"))
                .isInstanceOf(NotFoundException.class);
        verify(assignedRepository, never()).save(any());
    }

    @Test
    @DisplayName("setDevices: throws NotFoundException when the schedule is soft-deleted")
    void setDevices_whenScheduleDeleted_throws() {
        scheduleExists(ScriptStatus.DELETED);

        assertThatThrownBy(() -> service.setDevices(SCHEDULE_ID, List.of("m-1"), "user-1"))
                .isInstanceOf(NotFoundException.class);
        verify(assignedRepository, never()).save(any());
    }

    @Test
    @DisplayName("getMachineIdsByScheduleIds: maps each schedule to its assigned machines (one doc per schedule)")
    void getMachineIdsByScheduleIds_maps() {
        ScriptScheduleMachineAssigned a = ScriptScheduleMachineAssigned.builder()
                .scriptScheduleId("sch-1").machineIds(List.of("m-1", "m-2")).build();
        ScriptScheduleMachineAssigned b = ScriptScheduleMachineAssigned.builder()
                .scriptScheduleId("sch-2").machineIds(List.of("m-2", "m-3")).build();
        when(assignedRepository.findByTenantIdAndScriptScheduleIdIn(eq(TENANT_ID), any()))
                .thenReturn(List.of(a, b));

        Map<String, List<String>> result = service.getMachineIdsByScheduleIds(List.of("sch-1", "sch-2"));

        assertThat(result.get("sch-1")).containsExactly("m-1", "m-2");
        assertThat(result.get("sch-2")).containsExactly("m-2", "m-3");
    }

    @Test
    @DisplayName("setDevices: does NOT write back to the schedule document — device count is computed at read time from script_schedules_machines_assigned")
    void setDevices_doesNotWriteScheduleDoc() {
        scheduleExistsReturning(ScriptStatus.ACTIVE);
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT_ID, SCHEDULE_ID))
                .thenReturn(Optional.empty());
        when(assignedRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.setDevices(SCHEDULE_ID, List.of("m-1", "m-2", "m-1"), "user-1");

        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("getMachineIdsByScheduleIds: empty input short-circuits without a repository call")
    void getMachineIdsByScheduleIds_empty_noLookup() {
        assertThat(service.getMachineIdsByScheduleIds(List.of())).isEmpty();
        verify(assignedRepository, never()).findByTenantIdAndScriptScheduleIdIn(anyString(), any());
    }
}
