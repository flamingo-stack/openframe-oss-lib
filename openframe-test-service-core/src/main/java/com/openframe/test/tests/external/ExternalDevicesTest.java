package com.openframe.test.tests.external;

import com.openframe.test.api.external.ExternalDeviceApi;
import com.openframe.test.data.dto.external.common.ExternalErrorResponse;
import com.openframe.test.data.dto.external.device.DeviceFilterResponse;
import com.openframe.test.data.dto.external.device.DeviceResponse;
import com.openframe.test.data.dto.external.device.DevicesResponse;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.condition.EnabledIf;

import java.util.List;
import java.util.Map;

import static com.openframe.test.data.generator.external.ExternalTestData.uniqueName;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code /api/v1/devices}.
 *
 * <p>Devices are the one resource here the suite cannot create, so every case works against whatever the
 * tenant already has. That constrains what may be mutated: the nickname round-trip captures and restores
 * the original value, and the status case is <b>excluded from the default run</b> — see
 * {@link #testUpdateDeviceStatus()}.
 */
@Tag("external-api")
@EnabledIf(ExternalApiBaseTest.EXTERNAL_API_KEY_CONDITION)
@DisplayName("ExtApi: External API - Devices")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Slf4j
public class ExternalDevicesTest extends ExternalApiBaseTest {

    private static final String UNKNOWN_MACHINE_ID = "00000000-0000-0000-0000-000000000000";

    @Tag("feature")
    @Tag("read")
    @Tag("device")
    @Order(1)
    @Test
    @DisplayName("ExtApi: List devices")
    public void testListDevices() {
        DevicesResponse response = ExternalDeviceApi.listDevices(Map.of("limit", 10));

        assertThat(response.getPageInfo()).as("Paginated response should carry pageInfo").isNotNull();
        assertThat(response.getDevices()).as("Devices collection should be present").isNotNull();
        assertThat(response.getDevices()).as("Page should respect the requested limit")
                .hasSizeLessThanOrEqualTo(10);
        assertThat(response.getDevices()).allSatisfy(device -> {
            assertThat(device.getId()).as("Device id should not be null").isNotNull();
            assertThat(device.getMachineId()).as("Device machineId should not be null").isNotNull();
            assertThat(device.getStatus()).as("Device status should not be null").isNotNull();
        });
    }

    @Tag("feature")
    @Tag("read")
    @Tag("device")
    @Order(2)
    @Test
    @DisplayName("ExtApi: List devices with tags included")
    public void testListDevicesWithTags() {
        List<DeviceResponse> devices = ExternalDeviceApi
                .listDevices(Map.of("limit", 5, "includeTags", true)).getDevices();

        // includeTags is the switch between a null tags field and a materialised (possibly empty) list.
        assertThat(devices).as("Expected at least one device on the tenant").isNotEmpty();
        assertThat(devices).as("includeTags=true should populate the tags collection")
                .allSatisfy(device -> assertThat(device.getTags()).isNotNull());
    }

    @Tag("feature")
    @Tag("read")
    @Tag("device")
    @Order(3)
    @Test
    @DisplayName("ExtApi: Get device filter options")
    public void testGetDeviceFilters() {
        DeviceFilterResponse filters = ExternalDeviceApi.getFilters();

        assertThat(filters).as("Filter response should not be null").isNotNull();
        assertThat(filters.getFilteredCount()).as("Filtered count should not be negative")
                .isGreaterThanOrEqualTo(0);
        if (filters.getStatuses() != null) {
            assertThat(filters.getStatuses()).allSatisfy(item -> {
                assertThat(item.getValue()).as("Status filter option value").isNotNull();
                assertThat(item.getCount()).as("Status filter option count").isGreaterThanOrEqualTo(0);
            });
        }
    }

    @Tag("feature")
    @Tag("read")
    @Tag("device")
    @Order(4)
    @Test
    @DisplayName("ExtApi: Get device by machine ID")
    public void testGetDeviceByMachineId() {
        DeviceResponse listed = firstDevice();
        DeviceResponse fetched = ExternalDeviceApi.getDevice(listed.getMachineId());

        assertThat(fetched.getMachineId()).as("Fetched device should be the one requested")
                .isEqualTo(listed.getMachineId());
        // The single-device read is a different query path from the list projection, so the shared
        // fields are compared rather than merely spot-checked. Three exclusions, all legitimate:
        //   tags      - the list call above did not request them (includeTags defaults to false);
        //   lastSeen  - a live agent checks in between the two calls, and rate-limit pacing puts them
        //   updatedAt   a full minute apart, so these tick almost every run. Asserting on them would
        //               be asserting that the device stopped reporting, which is the opposite of what
        //               a healthy tenant should show.
        assertThat(fetched).as("Single-device read should agree with the list projection")
                .usingRecursiveComparison()
                .ignoringFields("tags", "lastSeen", "updatedAt")
                .isEqualTo(listed);

        // The liveness fields are still checked, just as monotonic rather than equal.
        assertThat(fetched.getLastSeen()).as("lastSeen should not move backwards between reads")
                .isAfterOrEqualTo(listed.getLastSeen());
        assertThat(fetched.getUpdatedAt()).as("updatedAt should not move backwards between reads")
                .isAfterOrEqualTo(listed.getUpdatedAt());
    }

    @Tag("feature")
    @Tag("read")
    @Tag("device")
    @Order(5)
    @Test
    @DisplayName("ExtApi: Get device returns 404 for an unknown machine ID")
    public void testGetUnknownDevice() {
        ExternalErrorResponse error = ExternalDeviceApi.attemptGetDevice(UNKNOWN_MACHINE_ID, 404);
        assertThat(error.getCode()).as("Unknown device should report an error code").isNotNull();
    }

    @Tag("feature")
    @Tag("read")
    @Tag("device")
    @Order(6)
    @Test
    @DisplayName("ExtApi: Filter devices by an advertised status")
    public void testFilterDevicesByStatus() {
        DeviceFilterResponse filters = ExternalDeviceApi.getFilters();
        if (filters.getStatuses() == null || filters.getStatuses().isEmpty()) {
            log.info("No device statuses advertised on this tenant; nothing to filter by");
            return;
        }

        String status = filters.getStatuses().getFirst().getValue();
        List<DeviceResponse> devices = ExternalDeviceApi
                .listDevices(Map.of("statuses", status, "limit", 10)).getDevices();

        assertThat(devices).as("Status '%s' is advertised as a filter option", status).isNotEmpty();
        assertThat(devices).as("Every returned device should carry the requested status")
                .allSatisfy(device -> assertThat(device.getStatus()).isEqualTo(status));
    }

    @Tag("feature")
    @Tag("update")
    @Tag("device")
    @Order(7)
    @Test
    @DisplayName("ExtApi: Update and restore device nickname")
    public void testUpdateDeviceNickname() {
        DeviceResponse device = firstDevice();
        String machineId = device.getMachineId();
        String original = device.getNickname();
        String nickname = uniqueName("Nickname");

        try {
            ExternalDeviceApi.updateNickname(machineId, nickname);
            assertThat(ExternalDeviceApi.getDevice(machineId).getNickname())
                    .as("Nickname should be persisted").isEqualTo(nickname);
        } finally {
            // This is the only place the suite writes to a record it did not create, so the original
            // value goes back even if the assertion above failed.
            ExternalDeviceApi.updateNicknameRaw(machineId, original);
        }

        assertThat(ExternalDeviceApi.getDevice(machineId).getNickname())
                .as("Original nickname should be restored").isEqualTo(original);
    }

    /**
     * Excluded from the default run.
     *
     * <p>{@code PATCH /api/v1/devices/{machineId}} accepts only terminal states (DELETED, ARCHIVED) and
     * the External API offers no way back to ACTIVE, so running this against a live device destroys it —
     * including the device a pipeline run has just installed. It is kept as an explicitly selected case
     * ({@code destructive}) rather than deleted, so the endpoint can be exercised deliberately against an
     * expendable device.
     */
    @Tag("destructive")
    @Tag("device")
    @Order(8)
    @Test
    @DisplayName("ExtApi: Update device status (destructive; opt-in)")
    public void testUpdateDeviceStatus() {
        List<DeviceResponse> archived = ExternalDeviceApi
                .listDevices(Map.of("statuses", "ARCHIVED", "limit", 1)).getDevices();
        if (archived.isEmpty()) {
            log.info("No already-archived device available; skipping rather than archiving a live one");
            return;
        }

        String machineId = archived.getFirst().getMachineId();
        ExternalDeviceApi.updateStatus(machineId, "ARCHIVED");

        assertThat(ExternalDeviceApi.getDevice(machineId).getStatus())
                .as("Device should remain archived").isEqualTo("ARCHIVED");
    }

    private static DeviceResponse firstDevice() {
        List<DeviceResponse> devices = ExternalDeviceApi.listDevices(Map.of("limit", 1)).getDevices();
        assertThat(devices).as("Tenant needs at least one device for the device cases").isNotEmpty();
        return devices.getFirst();
    }
}
