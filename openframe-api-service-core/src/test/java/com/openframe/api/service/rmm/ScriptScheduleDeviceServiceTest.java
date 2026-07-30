package com.openframe.api.service.rmm;

import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.ScheduleDeviceCriteria;
import com.openframe.data.document.rmm.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.CriteriaScheduleMaterializer;
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
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ScriptScheduleDeviceServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String SCHEDULE_ID = "sch-1";

    private ScriptScheduleMachineAssignedRepository assignedRepository;
    private ScriptScheduleRepository scheduleRepository;
    private MachineRepository machineRepository;
    private CriteriaScheduleMaterializer criteriaScheduleMaterializer;
    private ScriptScheduleDeviceService service;

    @BeforeEach
    void setUp() {
        assignedRepository = mock(ScriptScheduleMachineAssignedRepository.class);
        scheduleRepository = mock(ScriptScheduleRepository.class);
        machineRepository = mock(MachineRepository.class);
        criteriaScheduleMaterializer = mock(CriteriaScheduleMaterializer.class);
        TenantIdProvider tenantIdProvider = mock(TenantIdProvider.class);
        service = new ScriptScheduleDeviceService(assignedRepository, scheduleRepository, machineRepository, criteriaScheduleMaterializer, tenantIdProvider);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        // By default every requested machineId resolves to an in-tenant device (osType "windows");
        // platform/existence tests override this stub with their own machines.
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT_ID), any())).thenAnswer(inv -> {
            java.util.Collection<String> ids = inv.getArgument(1);
            return ids.stream().map(id -> machine(id, id, "windows")).toList();
        });
    }

    private void scheduleExists(ScriptStatus status) {
        ScriptSchedule schedule = ScriptSchedule.builder().id(SCHEDULE_ID).status(status).build();
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(schedule));
    }

    private void scheduleExistsWithPlatforms(ScriptStatus status, List<ScriptPlatform> platforms) {
        ScriptSchedule schedule = ScriptSchedule.builder().id(SCHEDULE_ID).status(status).supportedPlatforms(platforms).build();
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(schedule));
    }

    private static Machine machine(String machineId, String hostname, String osType) {
        Machine m = new Machine();
        m.setMachineId(machineId);
        m.setHostname(hostname);
        m.setOsType(osType);
        return m;
    }

    private static ScriptScheduleMachineAssigned pair(String machineId) {
        return pairFor(SCHEDULE_ID, machineId);
    }

    private static ScriptScheduleMachineAssigned pairFor(String scheduleId, String machineId) {
        return ScriptScheduleMachineAssigned.builder()
                .tenantId(TENANT_ID).scriptScheduleId(scheduleId).machineId(machineId).build();
    }

    @Test
    @DisplayName("setDevices: no existing rows → inserts one doc per (schedule, machine) pair with createdBy stamped, deduped/preserved order")
    void setDevices_whenNoAssignment_insertsAllPairs() {
        scheduleExists(ScriptStatus.ACTIVE);
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT_ID, SCHEDULE_ID))
                .thenReturn(List.of());

        service.setDevices(SCHEDULE_ID, List.of("m-1", "m-2", "m-1"), "user-1");

        ArgumentCaptor<List<ScriptScheduleMachineAssigned>> captor = ArgumentCaptor.forClass(List.class);
        verify(assignedRepository).saveAll(captor.capture());
        List<ScriptScheduleMachineAssigned> saved = captor.getValue();
        assertThat(saved).hasSize(2);
        assertThat(saved).extracting(ScriptScheduleMachineAssigned::getMachineId)
                .containsExactly("m-1", "m-2");   // deduped, order preserved
        assertThat(saved).allSatisfy(r -> {
            assertThat(r.getTenantId()).isEqualTo(TENANT_ID);
            assertThat(r.getScriptScheduleId()).isEqualTo(SCHEDULE_ID);
            assertThat(r.getCreatedBy()).isEqualTo("user-1");
        });
        // Nothing to remove — deleteBy never called.
        verify(assignedRepository, never()).deleteByTenantIdAndScriptScheduleIdAndMachineIdIn(any(), any(), any());
    }

    @Test
    @DisplayName("setDevices: a device whose OS is not among the schedule's platforms is rejected (Windows device on a macOS schedule)")
    void setDevices_deviceOsMismatch_rejected() {
        scheduleExistsWithPlatforms(ScriptStatus.ACTIVE, List.of(ScriptPlatform.MACOS));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT_ID), any()))
                .thenReturn(List.of(machine("m-win", "win-box", "windows")));

        assertThatThrownBy(() -> service.setDevices(SCHEDULE_ID, List.of("m-win"), "user-1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("win-box");
        verify(assignedRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("setDevices: a device whose OS matches the schedule's platform is accepted (case-insensitive: macos == MACOS)")
    void setDevices_deviceOsMatch_accepted() {
        scheduleExistsWithPlatforms(ScriptStatus.ACTIVE, List.of(ScriptPlatform.MACOS));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT_ID), any()))
                .thenReturn(List.of(machine("m-mac", "mac-box", "macos")));
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT_ID, SCHEDULE_ID)).thenReturn(List.of());

        service.setDevices(SCHEDULE_ID, List.of("m-mac"), "user-1");

        verify(assignedRepository).saveAll(any());
    }

    @Test
    @DisplayName("setDevices: a device with unknown/blank osType is allowed (can't determine platform)")
    void setDevices_unknownOs_allowed() {
        scheduleExistsWithPlatforms(ScriptStatus.ACTIVE, List.of(ScriptPlatform.MACOS));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT_ID), any()))
                .thenReturn(List.of(machine("m-x", "x-box", null)));
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT_ID, SCHEDULE_ID)).thenReturn(List.of());

        service.setDevices(SCHEDULE_ID, List.of("m-x"), "user-1");

        verify(assignedRepository).saveAll(any());
    }

    @Test
    @DisplayName("setDevices: legacy raw osType ('Windows 11') canonicalizes via the classifier — a WINDOWS schedule accepts it")
    void setDevices_legacyRawWindowsOsType_accepted() {
        scheduleExistsWithPlatforms(ScriptStatus.ACTIVE, List.of(ScriptPlatform.WINDOWS));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT_ID), any()))
                .thenReturn(List.of(machine("m-win", "win-11-box", "Windows 11")));
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT_ID, SCHEDULE_ID)).thenReturn(List.of());

        service.setDevices(SCHEDULE_ID, List.of("m-win"), "user-1");

        verify(assignedRepository).saveAll(any());
    }

    @Test
    @DisplayName("setDevices: legacy raw osType ('darwin') canonicalizes via the classifier — a MACOS schedule accepts it")
    void setDevices_legacyRawDarwinOsType_accepted() {
        scheduleExistsWithPlatforms(ScriptStatus.ACTIVE, List.of(ScriptPlatform.MACOS));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT_ID), any()))
                .thenReturn(List.of(machine("m-mac", "mac-box", "darwin")));
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT_ID, SCHEDULE_ID)).thenReturn(List.of());

        service.setDevices(SCHEDULE_ID, List.of("m-mac"), "user-1");

        verify(assignedRepository).saveAll(any());
    }

    @Test
    @DisplayName("setDevices: batch mixing canonical + legacy shapes for the schedule's platforms is fully persisted — regression for \"can't assign more than one device\"")
    void setDevices_mixedCanonicalAndLegacyForSamePlatforms_allAccepted() {
        scheduleExistsWithPlatforms(ScriptStatus.ACTIVE,
                List.of(ScriptPlatform.WINDOWS, ScriptPlatform.MACOS));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT_ID), any()))
                .thenReturn(List.of(
                        machine("m-win-new", "win-new", "WINDOWS"),          // canonical
                        machine("m-win-legacy", "win-legacy", "Windows 11"), // legacy raw
                        machine("m-mac-new", "mac-new", "MACOS"),            // canonical
                        machine("m-mac-legacy", "mac-legacy", "darwin")));   // legacy raw
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT_ID, SCHEDULE_ID)).thenReturn(List.of());

        service.setDevices(SCHEDULE_ID,
                List.of("m-win-new", "m-win-legacy", "m-mac-new", "m-mac-legacy"),
                "user-1");

        ArgumentCaptor<List<ScriptScheduleMachineAssigned>> captor = ArgumentCaptor.forClass(List.class);
        verify(assignedRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).extracting(ScriptScheduleMachineAssigned::getMachineId)
                .containsExactly("m-win-new", "m-win-legacy", "m-mac-new", "m-mac-legacy");
    }

    @Test
    @DisplayName("setDevices: legacy raw osType still incompatible with the schedule's platforms is rejected (Windows 11 device on a MACOS-only schedule)")
    void setDevices_legacyRawIncompatible_rejected() {
        scheduleExistsWithPlatforms(ScriptStatus.ACTIVE, List.of(ScriptPlatform.MACOS));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT_ID), any()))
                .thenReturn(List.of(machine("m-win", "win-11-box", "Windows 11")));

        assertThatThrownBy(() -> service.setDevices(SCHEDULE_ID, List.of("m-win"), "user-1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("win-11-box");
        verify(assignedRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("setDevices: diffs current vs requested — only truly added/removed pairs cause writes; unchanged rows are left alone (audit-preserving)")
    void setDevices_diffOnly() {
        scheduleExists(ScriptStatus.ACTIVE);
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT_ID, SCHEDULE_ID))
                .thenReturn(List.of(pair("m-1"), pair("m-2")));

        service.setDevices(SCHEDULE_ID, List.of("m-1", "m-3"), "user-2");

        // Removed: m-2. Added: m-3. Kept: m-1 (no write).
        verify(assignedRepository).deleteByTenantIdAndScriptScheduleIdAndMachineIdIn(
                eq(TENANT_ID), eq(SCHEDULE_ID), argThatContainsExactly("m-2"));
        ArgumentCaptor<List<ScriptScheduleMachineAssigned>> saved = ArgumentCaptor.forClass(List.class);
        verify(assignedRepository).saveAll(saved.capture());
        assertThat(saved.getValue()).extracting(ScriptScheduleMachineAssigned::getMachineId).containsExactly("m-3");
    }

    @Test
    @DisplayName("setDevices: empty requested list → deletes ALL current pairs, inserts nothing")
    void setDevices_emptyList_clears() {
        scheduleExists(ScriptStatus.ACTIVE);
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT_ID, SCHEDULE_ID))
                .thenReturn(List.of(pair("m-1"), pair("m-2")));

        service.setDevices(SCHEDULE_ID, List.of(), "user-1");

        verify(assignedRepository).deleteByTenantIdAndScriptScheduleIdAndMachineIdIn(
                eq(TENANT_ID), eq(SCHEDULE_ID), argThatContainsExactlyInAnyOrder("m-1", "m-2"));
        verify(assignedRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("setDevices: requested equals current → no writes at all (fully idempotent)")
    void setDevices_noOpWhenUnchanged() {
        scheduleExists(ScriptStatus.ACTIVE);
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT_ID, SCHEDULE_ID))
                .thenReturn(List.of(pair("m-1"), pair("m-2")));

        service.setDevices(SCHEDULE_ID, List.of("m-1", "m-2"), "user-1");

        verify(assignedRepository, never()).saveAll(any());
        verify(assignedRepository, never()).deleteByTenantIdAndScriptScheduleIdAndMachineIdIn(any(), any(), any());
    }

    @Test
    @DisplayName("setDevices: throws NotFoundException when the schedule does not exist")
    void setDevices_whenScheduleMissing_throws() {
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.setDevices(SCHEDULE_ID, List.of("m-1"), "user-1"))
                .isInstanceOf(NotFoundException.class);
        verify(assignedRepository, never()).saveAll(any());
        verify(assignedRepository, never()).deleteByTenantIdAndScriptScheduleIdAndMachineIdIn(any(), any(), any());
    }

    @Test
    @DisplayName("setDevices: throws NotFoundException when the schedule is soft-deleted")
    void setDevices_whenScheduleDeleted_throws() {
        scheduleExists(ScriptStatus.DELETED);

        assertThatThrownBy(() -> service.setDevices(SCHEDULE_ID, List.of("m-1"), "user-1"))
                .isInstanceOf(NotFoundException.class);
        verifyNoInteractions(assignedRepository);
    }

    @Test
    @DisplayName("getMachineIdsByScheduleIds: groups the row-per-pair documents into per-schedule lists")
    void getMachineIdsByScheduleIds_groupsRows() {
        ScriptScheduleMachineAssigned a1 = ScriptScheduleMachineAssigned.builder()
                .scriptScheduleId("sch-1").machineId("m-1").build();
        ScriptScheduleMachineAssigned a2 = ScriptScheduleMachineAssigned.builder()
                .scriptScheduleId("sch-1").machineId("m-2").build();
        ScriptScheduleMachineAssigned b1 = ScriptScheduleMachineAssigned.builder()
                .scriptScheduleId("sch-2").machineId("m-2").build();
        ScriptScheduleMachineAssigned b2 = ScriptScheduleMachineAssigned.builder()
                .scriptScheduleId("sch-2").machineId("m-3").build();
        when(assignedRepository.findByTenantIdAndScriptScheduleIdIn(eq(TENANT_ID), any()))
                .thenReturn(List.of(a1, a2, b1, b2));

        Map<String, List<String>> result = service.getMachineIdsByScheduleIds(List.of("sch-1", "sch-2"));

        assertThat(result.get("sch-1")).containsExactlyInAnyOrder("m-1", "m-2");
        assertThat(result.get("sch-2")).containsExactlyInAnyOrder("m-2", "m-3");
    }

    @Test
    @DisplayName("setDevices: does NOT write back to the schedule document — device count is computed at read time from the assignment collection")
    void setDevices_doesNotWriteScheduleDoc() {
        scheduleExists(ScriptStatus.ACTIVE);
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT_ID, SCHEDULE_ID))
                .thenReturn(List.of());

        service.setDevices(SCHEDULE_ID, List.of("m-1", "m-2"), "user-1");

        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("getMachineIdsByScheduleIds: empty input short-circuits without a repository call")
    void getMachineIdsByScheduleIds_empty_noLookup() {
        assertThat(service.getMachineIdsByScheduleIds(List.of())).isEmpty();
        verify(assignedRepository, never()).findByTenantIdAndScriptScheduleIdIn(anyString(), any());
    }

    @Test
    @DisplayName("addDevices: inserts only NEW pairs, skips already-assigned (idempotent)")
    void addDevices_skipsExisting() {
        scheduleExists(ScriptStatus.ACTIVE);
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT_ID, SCHEDULE_ID))
                .thenReturn(List.of(pair("m-1")));   // m-1 already assigned

        service.addDevices(SCHEDULE_ID, List.of("m-1", "m-2"), "user-1");

        ArgumentCaptor<List<ScriptScheduleMachineAssigned>> captor = ArgumentCaptor.forClass(List.class);
        verify(assignedRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).extracting(ScriptScheduleMachineAssigned::getMachineId)
                .containsExactly("m-2");   // only the new one
    }

    @Test
    @DisplayName("addDevices: a platform-mismatched device is rejected (Windows device on a macOS schedule)")
    void addDevices_platformMismatch_rejected() {
        scheduleExistsWithPlatforms(ScriptStatus.ACTIVE, List.of(ScriptPlatform.MACOS));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT_ID), any()))
                .thenReturn(List.of(machine("m-win", "win-box", "windows")));

        assertThatThrownBy(() -> service.addDevices(SCHEDULE_ID, List.of("m-win"), "user-1"))
                .isInstanceOf(BadRequestException.class);
        verify(assignedRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("addDevices: an unknown / cross-tenant machineId is rejected — never persisted as an assignment")
    void addDevices_unknownMachineId_rejected() {
        scheduleExists(ScriptStatus.ACTIVE);
        // only m-known resolves in this tenant; m-ghost is absent (unknown or belongs to another tenant)
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT_ID), any()))
                .thenReturn(List.of(machine("m-known", "known-box", "windows")));

        assertThatThrownBy(() -> service.addDevices(SCHEDULE_ID, List.of("m-known", "m-ghost"), "user-1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("m-ghost");
        verify(assignedRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("setDevices: an unknown / cross-tenant machineId is rejected before any write")
    void setDevices_unknownMachineId_rejected() {
        scheduleExists(ScriptStatus.ACTIVE);
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT_ID), any()))
                .thenReturn(List.of(machine("m-known", "known-box", "windows")));

        assertThatThrownBy(() -> service.setDevices(SCHEDULE_ID, List.of("m-known", "m-ghost"), "user-1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("m-ghost");
        verify(assignedRepository, never()).saveAll(any());
        verify(assignedRepository, never()).deleteByTenantIdAndScriptScheduleIdAndMachineIdIn(any(), any(), any());
    }

    @Test
    @DisplayName("removeDevices: deletes the given pairs by machineId")
    void removeDevices_deletesByIds() {
        scheduleExists(ScriptStatus.ACTIVE);

        service.removeDevices(SCHEDULE_ID, List.of("m-1", "m-2"), "user-1");

        verify(assignedRepository).deleteByTenantIdAndScriptScheduleIdAndMachineIdIn(
                eq(TENANT_ID), eq(SCHEDULE_ID), any());
    }

    @Test
    @DisplayName("applyCriteria: switches to CRITERIA, stores the rule, saves, and materialises the matching devices")
    void applyCriteria_setsModeStoresRuleAndMaterialises() {
        scheduleExists(ScriptStatus.ACTIVE);
        ScheduleDeviceCriteria criteria = ScheduleDeviceCriteria.builder()
                .organizationIds(List.of("org-1")).osTypes(List.of("WINDOWS")).build();

        service.applyCriteria(SCHEDULE_ID, criteria, "user-1");

        ArgumentCaptor<ScriptSchedule> captor = ArgumentCaptor.forClass(ScriptSchedule.class);
        verify(scheduleRepository).save(captor.capture());
        ScriptSchedule saved = captor.getValue();
        assertThat(saved.getSelectionMode()).isEqualTo(ScheduleDeviceSelectionMode.CRITERIA);
        assertThat(saved.getDeviceCriteria()).isEqualTo(criteria);
        // the criteria set is persisted as join rows, not resolved lazily
        verify(criteriaScheduleMaterializer).materialize(any(ScriptSchedule.class), eq("user-1"));
    }

    @Test
    @DisplayName("getMachineCountsByScheduleIds: counts join rows per schedule (uniform across modes)")
    void getMachineCountsByScheduleIds_countsJoinRows() {
        when(assignedRepository.findByTenantIdAndScriptScheduleIdIn(eq(TENANT_ID), any()))
                .thenReturn(List.of(pairFor("sch-1", "m-1"), pairFor("sch-1", "m-2"), pairFor("sch-2", "m-3")));

        Map<String, Integer> counts = service.getMachineCountsByScheduleIds(List.of("sch-1", "sch-2"));

        assertThat(counts).containsEntry("sch-1", 2).containsEntry("sch-2", 1);
    }

    @Test
    @DisplayName("getMachineCountsByScheduleIds: schedules with no assignments are absent (callers default to 0)")
    void getMachineCountsByScheduleIds_noRows_absent() {
        when(assignedRepository.findByTenantIdAndScriptScheduleIdIn(eq(TENANT_ID), any())).thenReturn(List.of());

        assertThat(service.getMachineCountsByScheduleIds(List.of("sch-1"))).isEmpty();
    }

    @Test
    @DisplayName("setDevices: flips a CRITERIA schedule back to SPECIFIC when devices are managed explicitly")
    void setDevices_flipsCriteriaToSpecific() {
        ScriptSchedule criteriaSchedule = ScriptSchedule.builder()
                .id(SCHEDULE_ID).status(ScriptStatus.ACTIVE)
                .selectionMode(ScheduleDeviceSelectionMode.CRITERIA).build();
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(criteriaSchedule));
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT_ID, SCHEDULE_ID)).thenReturn(List.of());

        service.setDevices(SCHEDULE_ID, List.of("m-1"), "user-1");

        ArgumentCaptor<ScriptSchedule> captor = ArgumentCaptor.forClass(ScriptSchedule.class);
        verify(scheduleRepository).save(captor.capture());
        assertThat(captor.getValue().getSelectionMode()).isEqualTo(ScheduleDeviceSelectionMode.SPECIFIC);
    }

    // Argument-matcher shortcuts for Collections (Mockito's `argThat` boilerplate collapsed).
    @SuppressWarnings("unchecked")
    private static <T> java.util.Collection<T> argThatContainsExactly(T... items) {
        return org.mockito.ArgumentMatchers.argThat(c -> c != null && c.size() == items.length
                && c.containsAll(java.util.Arrays.asList(items))
                && java.util.Arrays.asList(items).containsAll(c));
    }

    @SuppressWarnings("unchecked")
    private static <T> java.util.Collection<T> argThatContainsExactlyInAnyOrder(T... items) {
        return argThatContainsExactly(items);
    }
}
