package com.openframe.data.repository.device;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.MachineIntegrationTestApplication;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = MachineIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class CustomMachineRepositoryStatusSortIT extends BaseMongoIntegrationTest {

    private static final String TENANT = "tenant-1";
    private static final String OTHER_TENANT = "tenant-2";
    private static final MachineQueryFilter NO_FILTER = MachineQueryFilter.builder().build();

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private MachineRepository repository;

    @BeforeEach
    void seedInScrambledOrder() {
        mongoTemplate.dropCollection(Machine.class);
        save("offline-1", TENANT, DeviceStatus.OFFLINE);
        save("deleting-1", TENANT, DeviceStatus.PENDING_DELETION);
        save("online-1", TENANT, DeviceStatus.ONLINE);
        save("none-1", TENANT, null);
        save("pending-1", TENANT, DeviceStatus.PENDING);
        save("online-2", TENANT, DeviceStatus.ONLINE);
        save("offline-2", TENANT, DeviceStatus.OFFLINE);
        save("online-other-tenant", OTHER_TENANT, DeviceStatus.ONLINE);
    }

    @Test
    @DisplayName("status ASC: ONLINE, OFFLINE, PENDING, PENDING_DELETION, then devices without a status")
    void ascFollowsExplicitOrder() {
        List<Machine> page = repository.findMachinesWithCursor(TENANT, NO_FILTER, null, null, 50, "status", "ASC");

        assertThat(machineIds(page)).containsExactly(
                "online-1", "online-2", "offline-1", "offline-2", "pending-1", "deleting-1", "none-1");
    }

    @Test
    @DisplayName("status DESC: the exact reverse of the ASC order")
    void descReversesExplicitOrder() {
        List<Machine> page = repository.findMachinesWithCursor(TENANT, NO_FILTER, null, null, 50, "status", "DESC");

        assertThat(machineIds(page)).containsExactly(
                "none-1", "deleting-1", "pending-1", "offline-2", "offline-1", "online-2", "online-1");
    }

    @Test
    @DisplayName("status ASC paged by cursor: pages join without gaps or duplicates, even inside a status group")
    void ascCursorPagesWithoutGapsOrDuplicates() {
        assertThat(pageThrough("ASC", 3)).containsExactly(
                "online-1", "online-2", "offline-1", "offline-2", "pending-1", "deleting-1", "none-1");
    }

    @Test
    @DisplayName("status DESC paged by cursor: pages join without gaps or duplicates, even inside a status group")
    void descCursorPagesWithoutGapsOrDuplicates() {
        assertThat(pageThrough("DESC", 2)).containsExactly(
                "none-1", "deleting-1", "pending-1", "offline-2", "offline-1", "online-2", "online-1");
    }

    @Test
    @DisplayName("status sort never leaks another tenant's devices")
    void statusSortStaysInsideTenant() {
        List<Machine> page = repository.findMachinesWithCursor(OTHER_TENANT, NO_FILTER, null, null, 50, "status", "ASC");

        assertThat(machineIds(page)).containsExactly("online-other-tenant");
    }

    @Test
    @DisplayName("status sort honours the status filter and search like every other sort")
    void statusSortRespectsFilterAndSearch() {
        MachineQueryFilter onlyOffline = MachineQueryFilter.builder()
                .statuses(List.of("OFFLINE")).build();

        List<Machine> page = repository.findMachinesWithCursor(TENANT, onlyOffline, "host-offline-2", null, 50, "status", "ASC");

        assertThat(machineIds(page)).containsExactly("offline-2");
    }

    private List<String> pageThrough(String direction, int pageSize) {
        List<String> seen = new ArrayList<>();
        String cursor = null;
        for (int guard = 0; guard < 10; guard++) {
            List<Machine> page = repository.findMachinesWithCursor(TENANT, NO_FILTER, null, cursor, pageSize, "status", direction);
            if (page.isEmpty()) {
                return seen;
            }
            assertThat(page).hasSizeLessThanOrEqualTo(pageSize);
            seen.addAll(machineIds(page));
            cursor = page.getLast().getId();
        }
        return seen;
    }

    private static List<String> machineIds(List<Machine> machines) {
        return machines.stream().map(Machine::getMachineId).toList();
    }

    private void save(String machineId, String tenantId, DeviceStatus status) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        machine.setTenantId(tenantId);
        machine.setStatus(status);
        machine.setOrganizationId("org-1");
        machine.setType(DeviceType.LAPTOP);
        machine.setOsType(OsType.WINDOWS);
        machine.setHostname("host-" + machineId);
        mongoTemplate.save(machine);
    }
}
