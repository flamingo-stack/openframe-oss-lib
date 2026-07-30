package com.openframe.data.integration.repository.rmm;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.ScheduleDeviceCriteria;
import com.openframe.data.document.rmm.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.CriteriaScheduleMaterializerIntegrationTestApplication;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.rmm.CriteriaScheduleMaterializer;
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
 * Integration tests for {@link CriteriaScheduleMaterializer} against a real MongoDB. Locks the
 * persistence semantics that unit tests with a mocked repository cannot see: a criteria schedule's
 * join rows are reconciled to exactly its matches (case-insensitive osType, tenant scope, platform
 * intersection), and a (re)registering device is added to every matching CRITERIA schedule.
 */
@SpringBootTest(classes = CriteriaScheduleMaterializerIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class CriteriaScheduleMaterializerIT extends BaseMongoIntegrationTest {

    private static final String TENANT_A = "tenant-a";
    private static final String TENANT_B = "tenant-b";
    private static final String SCHEDULE_ID = "sch-1";

    @Autowired
    private MachineRepository machineRepository;

    @Autowired
    private ScriptScheduleMachineAssignedRepository assignedRepository;

    @Autowired
    private ScriptScheduleRepository scheduleRepository;

    @Autowired
    private CriteriaScheduleMaterializer materializer;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void reset() {
        mongoTemplate.remove(new Query(), Machine.class);
        mongoTemplate.remove(new Query(), ScriptScheduleMachineAssigned.class);
        mongoTemplate.remove(new Query(), ScriptSchedule.class);
    }

    @Test
    @DisplayName("materialize: writes a join row for every matching device (customer + platform, case-insensitive), tenant-scoped")
    void materialize_writesMatchingRows() {
        machine("m-win", TENANT_A, "org-1", DeviceType.LAPTOP, "windows");
        machine("m-mac", TENANT_A, "org-1", DeviceType.LAPTOP, "macos");        // wrong platform
        machine("m-win-org2", TENANT_A, "org-2", DeviceType.LAPTOP, "windows"); // wrong customer
        machine("m-win-tenantB", TENANT_B, "org-1", DeviceType.LAPTOP, "windows"); // wrong tenant

        ScriptSchedule schedule = criteriaSchedule(List.of(ScriptPlatform.WINDOWS),
                ScheduleDeviceCriteria.builder().organizationIds(List.of("org-1")).build());

        materializer.materialize(schedule, "user-1");

        assertThat(assignedMachineIds()).containsExactly("m-win");
    }

    @Test
    @DisplayName("materialize: reconciles — adds new matches and removes rows that no longer match")
    void materialize_reconcilesAddAndRemove() {
        machine("m-win", TENANT_A, "org-1", DeviceType.LAPTOP, "windows");
        // stale row for a device that is NOT a current match (e.g. left over from a previous rule / specific set)
        assignedRepository.save(row("m-stale"));

        ScriptSchedule schedule = criteriaSchedule(List.of(ScriptPlatform.WINDOWS), ScheduleDeviceCriteria.builder().build());

        materializer.materialize(schedule, "user-1");

        assertThat(assignedMachineIds()).containsExactly("m-win");   // m-stale removed, m-win added
    }

    @Test
    @DisplayName("materialize: is idempotent — running twice leaves the same single row per device")
    void materialize_idempotent() {
        machine("m-win", TENANT_A, "org-1", DeviceType.LAPTOP, "windows");
        ScriptSchedule schedule = criteriaSchedule(List.of(ScriptPlatform.WINDOWS), ScheduleDeviceCriteria.builder().build());

        materializer.materialize(schedule, "user-1");
        materializer.materialize(schedule, "user-1");

        assertThat(assignedMachineIds()).containsExactly("m-win");
    }

    @Test
    @DisplayName("materialize: a contradictory OS scope clears the schedule's rows (matches nothing)")
    void materialize_contradictoryScope_clears() {
        machine("m-win", TENANT_A, "org-1", DeviceType.LAPTOP, "windows");
        assignedRepository.save(row("m-old"));
        // supports MACOS but the rule asks for WINDOWS → nothing can match
        ScriptSchedule schedule = criteriaSchedule(List.of(ScriptPlatform.MACOS),
                ScheduleDeviceCriteria.builder().osTypes(List.of("WINDOWS")).build());

        materializer.materialize(schedule, "user-1");

        assertThat(assignedMachineIds()).isEmpty();
    }

    @Test
    @DisplayName("materializeForDevice: adds the device to every ACTIVE CRITERIA schedule it matches, idempotently")
    void materializeForDevice_addsToMatchingSchedules() {
        ScriptSchedule matching = saveCriteriaSchedule("sch-match", ScriptStatus.ACTIVE,
                List.of(ScriptPlatform.WINDOWS), ScheduleDeviceCriteria.builder().organizationIds(List.of("org-1")).build());
        ScriptSchedule wrongCustomer = saveCriteriaSchedule("sch-other", ScriptStatus.ACTIVE,
                List.of(ScriptPlatform.WINDOWS), ScheduleDeviceCriteria.builder().organizationIds(List.of("org-2")).build());
        ScriptSchedule archived = saveCriteriaSchedule("sch-archived", ScriptStatus.ARCHIVED,
                List.of(ScriptPlatform.WINDOWS), ScheduleDeviceCriteria.builder().build());

        Machine device = machine("m-win", TENANT_A, "org-1", DeviceType.LAPTOP, "windows");

        materializer.materializeForDevice(device);
        materializer.materializeForDevice(device);   // idempotent

        assertThat(scheduleIdsFor("m-win")).containsExactly("sch-match");
    }

    // --- helpers ---

    private Machine machine(String machineId, String tenantId, String orgId, DeviceType type, String osType) {
        Machine m = new Machine();
        m.setMachineId(machineId);
        m.setTenantId(tenantId);
        m.setOrganizationId(orgId);
        m.setType(type);
        m.setOsType(osType);
        m.setStatus(DeviceStatus.ONLINE);
        return machineRepository.save(m);
    }

    private static ScriptSchedule criteriaSchedule(List<ScriptPlatform> platforms, ScheduleDeviceCriteria criteria) {
        return ScriptSchedule.builder()
                .id(SCHEDULE_ID).tenantId(TENANT_A)
                .supportedPlatforms(platforms)
                .selectionMode(ScheduleDeviceSelectionMode.CRITERIA)
                .deviceCriteria(criteria)
                .build();
    }

    private ScriptSchedule saveCriteriaSchedule(String id, ScriptStatus status,
                                                List<ScriptPlatform> platforms, ScheduleDeviceCriteria criteria) {
        ScriptSchedule s = ScriptSchedule.builder()
                .id(id).tenantId(TENANT_A).name(id).status(status)
                .supportedPlatforms(platforms)
                .selectionMode(ScheduleDeviceSelectionMode.CRITERIA)
                .deviceCriteria(criteria)
                .build();
        return scheduleRepository.save(s);
    }

    private ScriptScheduleMachineAssigned row(String machineId) {
        return ScriptScheduleMachineAssigned.builder()
                .tenantId(TENANT_A).scriptScheduleId(SCHEDULE_ID).machineId(machineId).build();
    }

    private List<String> assignedMachineIds() {
        return assignedRepository.findByTenantIdAndScriptScheduleId(TENANT_A, SCHEDULE_ID).stream()
                .map(ScriptScheduleMachineAssigned::getMachineId).sorted().toList();
    }

    private List<String> scheduleIdsFor(String machineId) {
        return assignedRepository.findByTenantIdAndMachineId(TENANT_A, machineId).stream()
                .map(ScriptScheduleMachineAssigned::getScriptScheduleId).sorted().toList();
    }
}
