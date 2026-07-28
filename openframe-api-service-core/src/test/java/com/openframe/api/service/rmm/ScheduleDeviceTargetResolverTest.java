package com.openframe.api.service.rmm;

import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.ScheduleDeviceCriteria;
import com.openframe.data.document.rmm.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.service.rmm.ScheduleDeviceTargetResolver;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScheduleDeviceTargetResolverTest {

    private static final String TENANT = "tenant-1";
    private static final String SCHEDULE_ID = "sch-1";

    @Mock private MachineRepository machineRepository;
    @Mock private ScriptScheduleMachineAssignedRepository assignedRepository;

    @InjectMocks private ScheduleDeviceTargetResolver resolver;

    @Test
    @DisplayName("resolveTargetMachineIds: SPECIFIC reads the join rows (deduped)")
    void specific_readsJoinRows() {
        ScriptSchedule schedule = ScriptSchedule.builder()
                .id(SCHEDULE_ID).tenantId(TENANT)
                .selectionMode(ScheduleDeviceSelectionMode.SPECIFIC).build();
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT, SCHEDULE_ID))
                .thenReturn(List.of(pair("m-1"), pair("m-2"), pair("m-1")));

        assertThat(resolver.resolveTargetMachineIds(schedule)).containsExactly("m-1", "m-2");
        verifyNoInteractions(machineRepository);
    }

    @Test
    @DisplayName("resolveTargetMachineIds: CRITERIA resolves against the machines collection, tenant + platform scoped")
    void criteria_resolvesViaQuery() {
        ScriptSchedule schedule = ScriptSchedule.builder()
                .id(SCHEDULE_ID).tenantId(TENANT)
                .supportedPlatforms(List.of(ScriptPlatform.WINDOWS))
                .selectionMode(ScheduleDeviceSelectionMode.CRITERIA)
                .deviceCriteria(ScheduleDeviceCriteria.builder().organizationIds(List.of("org-1")).build())
                .build();
        when(machineRepository.buildDeviceQuery(any(), any())).thenReturn(new Query());
        when(machineRepository.findMachineIds(any())).thenReturn(List.of("m-9"));

        assertThat(resolver.resolveTargetMachineIds(schedule)).containsExactly("m-9");

        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        org.mockito.Mockito.verify(machineRepository).findMachineIds(captor.capture());
        var q = captor.getValue().getQueryObject();
        assertThat(q.get("tenantId")).isEqualTo(TENANT);           // tenant-scoped
        assertThat(q.get("$or")).isInstanceOf(List.class);         // WINDOWS platform scope applied
        verifyNoInteractions(assignedRepository);
    }

    @Test
    @DisplayName("matchesCriteria: true when customer + type + OS all match (OS case-insensitive)")
    void matches_allDimensions() {
        ScriptSchedule schedule = criteria(List.of(ScriptPlatform.WINDOWS),
                ScheduleDeviceCriteria.builder()
                        .organizationIds(List.of("org-1"))
                        .deviceTypes(List.of(DeviceType.LAPTOP))
                        .build());
        assertThat(resolver.matchesCriteria(schedule, machine("org-1", DeviceType.LAPTOP, "windows"))).isTrue();
    }

    @Test
    @DisplayName("matchesCriteria: false for a SPECIFIC schedule (those match via join rows)")
    void matches_falseForSpecific() {
        ScriptSchedule schedule = ScriptSchedule.builder()
                .selectionMode(ScheduleDeviceSelectionMode.SPECIFIC).build();
        assertThat(resolver.matchesCriteria(schedule, machine("org-1", DeviceType.LAPTOP, "windows"))).isFalse();
    }

    @Test
    @DisplayName("matchesCriteria: false when the customer is outside the criteria")
    void matches_orgMismatch() {
        ScriptSchedule schedule = criteria(null,
                ScheduleDeviceCriteria.builder().organizationIds(List.of("org-1")).build());
        assertThat(resolver.matchesCriteria(schedule, machine("org-2", DeviceType.LAPTOP, "windows"))).isFalse();
    }

    @Test
    @DisplayName("matchesCriteria: false when the OS is not among the schedule's supportedPlatforms")
    void matches_osOutsideSupportedPlatforms() {
        ScriptSchedule schedule = criteria(List.of(ScriptPlatform.MACOS),
                ScheduleDeviceCriteria.builder().build());   // no OS criterion → scope = supported (MACOS)
        assertThat(resolver.matchesCriteria(schedule, machine("org-1", DeviceType.LAPTOP, "windows"))).isFalse();
    }

    @Test
    @DisplayName("matchesCriteria: an empty rule with no supportedPlatforms matches everything")
    void matches_noConstraints() {
        ScriptSchedule schedule = criteria(null, ScheduleDeviceCriteria.builder().build());
        assertThat(resolver.matchesCriteria(schedule, machine("any", DeviceType.SERVER, "linux"))).isTrue();
    }

    private static ScriptSchedule criteria(List<ScriptPlatform> platforms, ScheduleDeviceCriteria criteria) {
        return ScriptSchedule.builder()
                .id(SCHEDULE_ID).tenantId(TENANT)
                .supportedPlatforms(platforms)
                .selectionMode(ScheduleDeviceSelectionMode.CRITERIA)
                .deviceCriteria(criteria)
                .build();
    }

    private static Machine machine(String orgId, DeviceType type, String osType) {
        Machine m = new Machine();
        m.setOrganizationId(orgId);
        m.setType(type);
        m.setOsType(osType);
        return m;
    }

    private static ScriptScheduleMachineAssigned pair(String machineId) {
        return ScriptScheduleMachineAssigned.builder()
                .tenantId(TENANT).scriptScheduleId(SCHEDULE_ID).machineId(machineId).build();
    }
}
