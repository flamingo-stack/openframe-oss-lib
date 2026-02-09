package com.openframe.test.tests;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.data.dto.device.DeviceFilters;
import com.openframe.test.data.dto.device.DeviceStatus;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.generator.DeviceGenerator;
import com.openframe.test.tests.base.AuthorizedTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.AssertionsForInterfaceTypes.assertThat;

@Tag("shared")
@DisplayName("Devices")
public class DevicesTest extends AuthorizedTest {

    @Tag("monitor")
    @Test
    @DisplayName("Verify device filters")
    public void testGetDeviceFilters() {
        DeviceFilters filters = DeviceApi.getDeviceFilters();
        assertThat(filters).isNotNull();
        assertThat(filters.getStatuses()).isNotEmpty();
        assertThat(filters.getStatuses().getFirst().getValue()).isNotNull();
        assertThat(filters.getStatuses().getFirst().getLabel()).isNotNull();
        assertThat(filters.getStatuses().getFirst().getCount()).isNotZero();
        assertThat(filters.getOsTypes()).isNotEmpty();
        assertThat(filters.getOsTypes().getFirst().getValue()).isNotNull();
        assertThat(filters.getOsTypes().getFirst().getLabel()).isNotNull();
        assertThat(filters.getOsTypes().getFirst().getCount()).isNotZero();
        assertThat(filters.getOrganizationIds()).isNotEmpty();
        assertThat(filters.getOrganizationIds().getFirst().getValue()).isNotNull();
        assertThat(filters.getOrganizationIds().getFirst().getLabel()).isNotNull();
        assertThat(filters.getOrganizationIds().getFirst().getCount()).isNotZero();
        assertThat(filters.getFilteredCount()).isNotZero();
    }

    @Tag("monitor")
    @Test
    @DisplayName("Get device by machineId")
    public void testGetDevice() {
        List<Machine> devices = DeviceApi.getDevices(DeviceGenerator.onlineDevicesFilter());
        assertThat(devices).as("Expected at least one ONLINE device").isNotEmpty();
        Machine device = DeviceApi.getDevice(devices.getFirst().getMachineId());
        assertThat(device).isNotNull();
    }

    @Tag("monitor")
    @Test
    @DisplayName("Search device by hostname")
    public void testSearchDevices() {
        List<String> hostnames = DeviceApi.getDeviceHostnames(DeviceGenerator.listedDevicesFilter());
        assertThat(hostnames).as("Expected at least one device with hostname").isNotEmpty();
        Machine device = DeviceApi.searchDevice(DeviceGenerator.listedDevicesFilter(), hostnames.getFirst());
        assertThat(device).isNotNull();
        assertThat(device.getHostname()).isEqualTo(hostnames.getFirst());
    }

    @Tag("monitor")
    @Test
    @DisplayName("Filter devices by status and OS")
    public void testFilterDevices() {
        List<Machine> devices = DeviceApi.getDevices(DeviceGenerator.statusAndOSDevicesFilter(DeviceStatus.ONLINE, "WINDOWS"));
        assertThat(devices).as("Expected at least one ONLINE WINDOWS device").isNotEmpty();
        assertThat(devices).allSatisfy(device -> {
            assertThat(device.getStatus()).isEqualTo(DeviceStatus.ONLINE);
            assertThat(device.getOsType()).isEqualTo("WINDOWS");
        });
    }

    @Test
    @DisplayName("Archive device")
    public void testArchiveDevice() {
        List<Machine> devices = DeviceApi.getDevices(DeviceGenerator.offlineDevicesFilter());
        assertThat(devices).as("Expected at least one OFFLINE device to archive").isNotEmpty();
        DeviceApi.archiveDevice(devices.getFirst());
        List<String> ids = DeviceApi.getDeviceIds(DeviceGenerator.listedDevicesFilter());
        assertThat(ids).doesNotContain(devices.getFirst().getMachineId());
    }

    @Test
    @DisplayName("Delete device")
    public void testDeleteDevice() {
        List<Machine> devices = DeviceApi.getDevices(DeviceGenerator.offlineDevicesFilter());
        assertThat(devices).as("Expected at least one OFFLINE device to delete").isNotEmpty();
        DeviceApi.deleteDevice(devices.getFirst());
        List<String> ids = DeviceApi.getDeviceIds(DeviceGenerator.listedDevicesFilter());
        assertThat(ids).doesNotContain(devices.getFirst().getMachineId());
    }
}
