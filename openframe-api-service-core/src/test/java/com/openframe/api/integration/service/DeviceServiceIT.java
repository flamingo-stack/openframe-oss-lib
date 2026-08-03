package com.openframe.api.integration.service;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.integration.BaseMongoIntegrationTest;
import com.openframe.api.integration.support.DeviceServiceIntegrationTestApplication;
import com.openframe.api.service.DeviceService;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
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
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for {@link DeviceService}'s platform-scoped picker queries against a real MongoDB.
 * The regression these guard: combining a customer/status filter with a platform scope used to build
 * two null-keyed criteria (a {@code $and} plus a {@code $or}), which the Mongo driver rejects
 * ({@code InvalidMongoDbApiUsage}) — a 500 in the "Available Devices" picker that a mocked-repository
 * unit test cannot see. Backs {@code ScriptSchedule.availableDevices} / "Add N Devices".
 */
@SpringBootTest(classes = DeviceServiceIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class DeviceServiceIT extends BaseMongoIntegrationTest {

    private static final String TENANT = "tenant-a";

    @Autowired
    private DeviceService deviceService;

    @Autowired
    private MachineRepository machineRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void reset() {
        mongoTemplate.remove(new Query(), Machine.class);
    }

    @Test
    @DisplayName("findDeviceIdsForPlatforms: a customer filter combined with a platform scope resolves (no InvalidMongoDbApiUsage), ANDing both")
    void findDeviceIdsForPlatforms_customerFilterPlusPlatform() {
        machine("m-win-org1", "org-1", DeviceType.LAPTOP, "windows");
        machine("m-win-org2", "org-2", DeviceType.LAPTOP, "windows");
        machine("m-mac-org1", "org-1", DeviceType.LAPTOP, "macos");

        DeviceFilterCriteria filter = DeviceFilterCriteria.builder()
                .organizationIds(List.of("org-1"))
                .build();

        List<String> ids = deviceService.findDeviceIdsForPlatforms(List.of("WINDOWS"), filter, null);

        assertThat(ids).containsExactly("m-win-org1");   // org-1 AND windows
    }

    @Test
    @DisplayName("queryDevicesForPlatforms: a status filter combined with a platform scope resolves and counts correctly")
    void queryDevicesForPlatforms_statusFilterPlusPlatform() {
        machine("m-online-win", "org-1", DeviceType.LAPTOP, "windows", DeviceStatus.ONLINE);
        machine("m-offline-win", "org-1", DeviceType.LAPTOP, "windows", DeviceStatus.OFFLINE);
        machine("m-online-mac", "org-1", DeviceType.LAPTOP, "macos", DeviceStatus.ONLINE);

        DeviceFilterCriteria filter = DeviceFilterCriteria.builder()
                .statuses(List.of(DeviceStatus.ONLINE))
                .build();

        CountedGenericQueryResult<Machine> result = deviceService.queryDevicesForPlatforms(
                List.of("WINDOWS"), filter, CursorPaginationCriteria.builder().limit(10).build(), null, null);

        assertThat(result.getFilteredCount()).isEqualTo(1);   // ONLINE AND windows
        assertThat(result.getItems()).extracting(Machine::getMachineId).containsExactly("m-online-win");
    }

    @Test
    @DisplayName("findDeviceIdsForPlatforms: platform scope with no filter still resolves (empty-filter path)")
    void findDeviceIdsForPlatforms_platformOnly() {
        machine("m-win", "org-1", DeviceType.LAPTOP, "windows");
        machine("m-mac", "org-1", DeviceType.LAPTOP, "macos");

        List<String> ids = deviceService.findDeviceIdsForPlatforms(List.of("WINDOWS"), null, null);

        assertThat(ids).containsExactly("m-win");
    }

    @Test
    @DisplayName("findDeviceIdsForPlatforms: matches osType case-insensitively across multiple platforms")
    void findDeviceIdsForPlatforms_multiPlatformCaseInsensitive() {
        machine("m-win", "org-1", DeviceType.LAPTOP, "windows");
        machine("m-mac", "org-1", DeviceType.LAPTOP, "macos");
        machine("m-lin", "org-1", DeviceType.SERVER, "linux");

        List<String> ids = deviceService.findDeviceIdsForPlatforms(List.of("WINDOWS", "MACOS"), null, null);

        assertThat(ids).containsExactlyInAnyOrder("m-win", "m-mac");
    }

    @Test
    @DisplayName("queryAvailableDevicesForSchedule: default order is assigned+ONLINE, assigned+OFFLINE, unassigned+ONLINE, unassigned+OFFLINE")
    void queryAvailableDevicesForSchedule_bucketOrder() {
        machine("a-on", "org-1", DeviceType.LAPTOP, "windows", DeviceStatus.ONLINE);
        machine("a-off", "org-1", DeviceType.LAPTOP, "windows", DeviceStatus.OFFLINE);
        machine("u-on1", "org-1", DeviceType.LAPTOP, "windows", DeviceStatus.ONLINE);
        machine("u-on2", "org-1", DeviceType.LAPTOP, "windows", DeviceStatus.ONLINE);
        machine("u-off", "org-1", DeviceType.LAPTOP, "windows", DeviceStatus.OFFLINE);

        CountedGenericQueryResult<Machine> result = deviceService.queryAvailableDevicesForSchedule(
                null, Set.of("a-on", "a-off"), null,
                CursorPaginationCriteria.builder().limit(10).build(), null);

        List<String> ids = result.getItems().stream().map(Machine::getMachineId).toList();
        assertThat(ids).hasSize(5);
        assertThat(ids.subList(0, 2)).containsExactly("a-on", "a-off");        // bucket 0, 1
        assertThat(ids.subList(2, 4)).containsExactlyInAnyOrder("u-on1", "u-on2");  // bucket 2
        assertThat(ids.get(4)).isEqualTo("u-off");                            // bucket 3
        assertThat(result.getFilteredCount()).isEqualTo(5);
    }

    @Test
    @DisplayName("queryAvailableDevicesForSchedule: compound (bucket|id) cursor paginates across a bucket boundary with no gaps or duplicates")
    void queryAvailableDevicesForSchedule_cursorPaginationAcrossBuckets() {
        machine("a-on", "org-1", DeviceType.LAPTOP, "windows", DeviceStatus.ONLINE);
        machine("a-off", "org-1", DeviceType.LAPTOP, "windows", DeviceStatus.OFFLINE);
        machine("u-on", "org-1", DeviceType.LAPTOP, "windows", DeviceStatus.ONLINE);
        machine("u-off", "org-1", DeviceType.LAPTOP, "windows", DeviceStatus.OFFLINE);
        Set<String> assigned = Set.of("a-on", "a-off");

        CountedGenericQueryResult<Machine> page1 = deviceService.queryAvailableDevicesForSchedule(
                null, assigned, null, CursorPaginationCriteria.builder().limit(2).build(), null);
        assertThat(page1.getItems()).extracting(Machine::getMachineId).containsExactly("a-on", "a-off");
        assertThat(page1.getPageInfo().isHasNextPage()).isTrue();

        // The service receives the already-decoded raw cursor "<bucket>|<id>"; a-off is bucket 1.
        Machine lastOfPage1 = page1.getItems().get(1);
        String cursor = "1|" + lastOfPage1.getId();

        CountedGenericQueryResult<Machine> page2 = deviceService.queryAvailableDevicesForSchedule(
                null, assigned, null, CursorPaginationCriteria.builder().limit(10).cursor(cursor).build(), null);
        assertThat(page2.getItems()).extracting(Machine::getMachineId).containsExactly("u-on", "u-off");  // buckets 2, 3
        assertThat(page2.getPageInfo().isHasNextPage()).isFalse();
    }

    @Test
    @DisplayName("queryAvailableDevicesForSchedule: soft-deleted (status DELETED) devices are excluded from the picker")
    void queryAvailableDevicesForSchedule_excludesDeleted() {
        machine("live-on", "org-1", DeviceType.LAPTOP, "windows", DeviceStatus.ONLINE);
        machine("live-off", "org-1", DeviceType.LAPTOP, "windows", DeviceStatus.OFFLINE);
        machine("gone", "org-1", DeviceType.LAPTOP, "windows", DeviceStatus.DELETED);

        CountedGenericQueryResult<Machine> result = deviceService.queryAvailableDevicesForSchedule(
                null, Set.of(), null, CursorPaginationCriteria.builder().limit(10).build(), null);

        assertThat(result.getItems()).extracting(Machine::getMachineId)
                .containsExactlyInAnyOrder("live-on", "live-off")
                .doesNotContain("gone");
        assertThat(result.getFilteredCount()).isEqualTo(2);
    }

    private void machine(String machineId, String orgId, DeviceType type, String osType) {
        machine(machineId, orgId, type, osType, DeviceStatus.ONLINE);
    }

    private void machine(String machineId, String orgId, DeviceType type, String osType, DeviceStatus status) {
        Machine m = new Machine();
        m.setMachineId(machineId);
        m.setTenantId(TENANT);
        m.setOrganizationId(orgId);
        m.setType(type);
        m.setOsType(osType);
        m.setStatus(status);
        machineRepository.save(m);
    }
}
