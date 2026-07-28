package com.openframe.data.integration.repository.rmm;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.ScheduleDeviceCriteria;
import com.openframe.data.document.rmm.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.ScheduleDeviceResolverIntegrationTestApplication;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.service.rmm.ScheduleDeviceTargetResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for {@link ScheduleDeviceTargetResolver} against a real MongoDB (Testcontainers).
 * These lock the query semantics that unit tests with a mocked repository cannot see and that bite in
 * a real environment: case-insensitive {@code osType} matching (osType is lowercase, platform names
 * are upper), {@code DeviceType} enum serialisation, tenant scoping, the criteria/supportedPlatforms
 * intersection, missing-field behaviour, and that {@code findMachineIds} projects {@code machineId}
 * (not {@code _id}).
 */
@SpringBootTest(classes = ScheduleDeviceResolverIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class ScheduleDeviceTargetResolverIT extends BaseMongoIntegrationTest {

    private static final String TENANT_A = "tenant-a";
    private static final String TENANT_B = "tenant-b";

    @Autowired
    private MachineRepository machineRepository;

    @Autowired
    private ScriptScheduleMachineAssignedRepository assignedRepository;

    @Autowired
    private ScheduleDeviceTargetResolver resolver;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void reset() {
        mongoTemplate.remove(new Query(), Machine.class);
        mongoTemplate.remove(new Query(), ScriptScheduleMachineAssigned.class);
    }

    @Test
    @DisplayName("CRITERIA: osType is matched case-insensitively against supportedPlatforms (lowercase 'windows' == WINDOWS)")
    void criteria_osTypeCaseInsensitive() {
        machine("m-win", TENANT_A, "org-1", DeviceType.LAPTOP, "windows");
        machine("m-mac", TENANT_A, "org-1", DeviceType.LAPTOP, "macos");

        ScriptSchedule schedule = criteria(List.of(ScriptPlatform.WINDOWS), ScheduleDeviceCriteria.builder().build());

        assertThat(resolver.resolveTargetMachineIds(schedule)).containsExactly("m-win");
    }

    @Test
    @DisplayName("CRITERIA: deviceTypes filters by the Machine.type enum (stored as its name)")
    void criteria_deviceTypeFilter() {
        machine("m-lap", TENANT_A, "org-1", DeviceType.LAPTOP, "windows");
        machine("m-desk", TENANT_A, "org-1", DeviceType.DESKTOP, "windows");

        ScriptSchedule schedule = criteria(List.of(ScriptPlatform.WINDOWS),
                ScheduleDeviceCriteria.builder().deviceTypes(List.of(DeviceType.LAPTOP)).build());

        assertThat(resolver.resolveTargetMachineIds(schedule)).containsExactly("m-lap");
    }

    @Test
    @DisplayName("CRITERIA: organizationIds scopes to the chosen customers")
    void criteria_organizationFilter() {
        machine("m1", TENANT_A, "org-1", DeviceType.LAPTOP, "windows");
        machine("m2", TENANT_A, "org-2", DeviceType.LAPTOP, "windows");

        ScriptSchedule schedule = criteria(List.of(ScriptPlatform.WINDOWS),
                ScheduleDeviceCriteria.builder().organizationIds(List.of("org-1")).build());

        assertThat(resolver.resolveTargetMachineIds(schedule)).containsExactly("m1");
    }

    @Test
    @DisplayName("CRITERIA: results are tenant-scoped — a matching device in another tenant does not leak in")
    void criteria_tenantIsolated() {
        machine("m-a", TENANT_A, "org-1", DeviceType.LAPTOP, "windows");
        machine("m-b", TENANT_B, "org-1", DeviceType.LAPTOP, "windows");

        ScriptSchedule schedule = criteria(List.of(ScriptPlatform.WINDOWS), ScheduleDeviceCriteria.builder().build());

        assertThat(resolver.resolveTargetMachineIds(schedule)).containsExactly("m-a");
    }

    @Test
    @DisplayName("CRITERIA: an osTypes criterion narrows within supportedPlatforms")
    void criteria_osTypesNarrowsWithinSupported() {
        machine("m-win", TENANT_A, "org-1", DeviceType.LAPTOP, "windows");
        machine("m-mac", TENANT_A, "org-1", DeviceType.LAPTOP, "macos");

        ScriptSchedule schedule = criteria(List.of(ScriptPlatform.WINDOWS, ScriptPlatform.MACOS),
                ScheduleDeviceCriteria.builder().osTypes(List.of("WINDOWS")).build());

        assertThat(resolver.resolveTargetMachineIds(schedule)).containsExactly("m-win");
    }

    @Test
    @DisplayName("CRITERIA: an osTypes criterion disjoint from supportedPlatforms matches nothing (contradictory scope)")
    void criteria_contradictoryOsScope_matchesNothing() {
        machine("m-win", TENANT_A, "org-1", DeviceType.LAPTOP, "windows");
        machine("m-mac", TENANT_A, "org-1", DeviceType.LAPTOP, "macos");

        // schedule supports only MACOS, but the rule asks for WINDOWS → no device can satisfy both
        ScriptSchedule schedule = criteria(List.of(ScriptPlatform.MACOS),
                ScheduleDeviceCriteria.builder().osTypes(List.of("WINDOWS")).build());

        assertThat(resolver.resolveTargetMachineIds(schedule)).isEmpty();
    }

    @Test
    @DisplayName("CRITERIA: a device with no osType is excluded once a platform scope applies (regex can't match a missing field)")
    void criteria_missingOsType_excludedUnderPlatformScope() {
        machine("m-known", TENANT_A, "org-1", DeviceType.LAPTOP, "windows");
        machine("m-null", TENANT_A, "org-1", DeviceType.LAPTOP, null);

        ScriptSchedule schedule = criteria(List.of(ScriptPlatform.WINDOWS), ScheduleDeviceCriteria.builder().build());

        assertThat(resolver.resolveTargetMachineIds(schedule)).containsExactly("m-known");
    }

    @Test
    @DisplayName("CRITERIA: customer + type + OS are ANDed — only the device satisfying all three matches")
    void criteria_allDimensionsAnded() {
        machine("hit", TENANT_A, "org-1", DeviceType.LAPTOP, "windows");
        machine("wrong-org", TENANT_A, "org-2", DeviceType.LAPTOP, "windows");
        machine("wrong-type", TENANT_A, "org-1", DeviceType.SERVER, "windows");
        machine("wrong-os", TENANT_A, "org-1", DeviceType.LAPTOP, "macos");

        ScriptSchedule schedule = criteria(List.of(ScriptPlatform.WINDOWS, ScriptPlatform.MACOS),
                ScheduleDeviceCriteria.builder()
                        .organizationIds(List.of("org-1"))
                        .deviceTypes(List.of(DeviceType.LAPTOP))
                        .osTypes(List.of("WINDOWS"))
                        .build());

        assertThat(resolver.resolveTargetMachineIds(schedule)).containsExactly("hit");
    }

    @Test
    @DisplayName("CRITERIA: no supportedPlatforms and an empty rule matches every device in the tenant")
    void criteria_unconstrained_matchesAllInTenant() {
        machine("m-win", TENANT_A, "org-1", DeviceType.LAPTOP, "windows");
        machine("m-lin", TENANT_A, "org-2", DeviceType.SERVER, "linux");
        machine("m-other-tenant", TENANT_B, "org-1", DeviceType.LAPTOP, "windows");

        ScriptSchedule schedule = criteria(null, ScheduleDeviceCriteria.builder().build());

        assertThat(resolver.resolveTargetMachineIds(schedule)).containsExactlyInAnyOrder("m-win", "m-lin");
    }

    @Test
    @DisplayName("countCriteriaMachines: returns the same count as the resolved id set, via a count query")
    void criteria_countMatchesResolvedSet() {
        machine("m-win1", TENANT_A, "org-1", DeviceType.LAPTOP, "windows");
        machine("m-win2", TENANT_A, "org-1", DeviceType.LAPTOP, "windows");
        machine("m-mac", TENANT_A, "org-1", DeviceType.LAPTOP, "macos");   // excluded by platform scope

        ScriptSchedule schedule = criteria(List.of(ScriptPlatform.WINDOWS), ScheduleDeviceCriteria.builder().build());

        assertThat(resolver.countCriteriaMachines(schedule)).isEqualTo(2L);
        assertThat(resolver.resolveTargetMachineIds(schedule)).hasSize(2);   // count agrees with the id set
    }

    @Test
    @DisplayName("SPECIFIC: reads the join rows for the schedule (deduped, tenant-scoped), ignoring the machines collection")
    void specific_readsJoinRows() {
        assignedRepository.save(pair("m-1"));
        assignedRepository.save(pair("m-2"));
        // a join row for a different schedule / tenant must not leak in
        assignedRepository.save(ScriptScheduleMachineAssigned.builder()
                .tenantId(TENANT_A).scriptScheduleId("other-sch").machineId("m-9").build());
        assignedRepository.save(ScriptScheduleMachineAssigned.builder()
                .tenantId(TENANT_B).scriptScheduleId("sch-1").machineId("m-3").build());

        ScriptSchedule schedule = ScriptSchedule.builder()
                .id("sch-1").tenantId(TENANT_A)
                .selectionMode(ScheduleDeviceSelectionMode.SPECIFIC).build();

        assertThat(resolver.resolveTargetMachineIds(schedule)).containsExactlyInAnyOrder("m-1", "m-2");
    }

    @Test
    @DisplayName("resolveTargetMachineIds returns the machineId value, not the Mongo _id")
    void criteria_returnsMachineIdNotObjectId() {
        machine("device-serial-123", TENANT_A, "org-1", DeviceType.LAPTOP, "windows");

        ScriptSchedule schedule = criteria(List.of(ScriptPlatform.WINDOWS), ScheduleDeviceCriteria.builder().build());

        List<String> ids = resolver.resolveTargetMachineIds(schedule);
        assertThat(ids).containsExactly("device-serial-123");
        // sanity: the stored _id is a different (ObjectId) value
        Machine stored = machineRepository.findByMachineId("device-serial-123").orElseThrow();
        assertThat(stored.getId()).isNotEqualTo("device-serial-123");
    }

    private void machine(String machineId, String tenantId, String orgId, DeviceType type, String osType) {
        Machine m = new Machine();
        m.setMachineId(machineId);
        m.setTenantId(tenantId);
        m.setOrganizationId(orgId);
        m.setType(type);
        m.setOsType(osType);
        m.setStatus(DeviceStatus.ONLINE);
        machineRepository.save(m);
    }

    private static ScriptSchedule criteria(List<ScriptPlatform> supportedPlatforms, ScheduleDeviceCriteria criteria) {
        return ScriptSchedule.builder()
                .id("sch-1").tenantId(TENANT_A)
                .supportedPlatforms(supportedPlatforms)
                .selectionMode(ScheduleDeviceSelectionMode.CRITERIA)
                .deviceCriteria(criteria)
                .build();
    }

    private static ScriptScheduleMachineAssigned pair(String machineId) {
        return ScriptScheduleMachineAssigned.builder()
                .tenantId(TENANT_A).scriptScheduleId("sch-1").machineId(machineId).build();
    }
}
