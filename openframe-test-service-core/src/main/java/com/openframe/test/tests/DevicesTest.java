package com.openframe.test.tests;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.data.dto.device.DeviceFilters;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.device.fleet.FleetHost;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static com.openframe.test.data.generator.DeviceGenerator.*;
import static org.assertj.core.api.AssertionsForInterfaceTypes.assertThat;

@Tag("saas")
@DisplayName("Devices")
public class DevicesTest {

    @Tag("read")
    @Test
    @DisplayName("Get device filters")
    public void testGetDeviceFilters() {
        DeviceFilters filters = DeviceApi.getDeviceFilters();
        assertThat(filters).as("Device filters should not be null").isNotNull();
        assertThat(filters.getStatuses()).as("Device filter statuses should not be empty").isNotEmpty();
        assertThat(filters.getStatuses().getFirst().getValue()).as("First status value should not be null").isNotNull();
        assertThat(filters.getStatuses().getFirst().getLabel()).as("First status label should not be null").isNotNull();
        assertThat(filters.getStatuses().getFirst().getCount()).as("First status count should not be zero").isNotZero();
        assertThat(filters.getOsTypes()).as("Device filter osTypes should not be empty").isNotEmpty();
        assertThat(filters.getOsTypes().getFirst().getValue()).as("First osType value should not be null").isNotNull();
        assertThat(filters.getOsTypes().getFirst().getLabel()).as("First osType label should not be null").isNotNull();
        assertThat(filters.getOsTypes().getFirst().getCount()).as("First osType count should not be zero").isNotZero();
        assertThat(filters.getOrganizationIds()).as("Device filter organizationIds should not be empty").isNotEmpty();
        assertThat(filters.getOrganizationIds().getFirst().getValue()).as("First organizationId value should not be null").isNotNull();
        assertThat(filters.getOrganizationIds().getFirst().getLabel()).as("First organizationId label should not be null").isNotNull();
        assertThat(filters.getOrganizationIds().getFirst().getCount()).as("First organizationId count should not be zero").isNotZero();
        assertThat(filters.getFilteredCount()).as("Device filter filteredCount should not be zero").isNotZero();
    }

    @Tag("read")
    @Test
    @DisplayName("Get device")
    public void testGetDevice() {
        Machine device = DeviceApi.getAnyDevice(onlineDevicesFilter(), offlineDevicesFilter());
        assertThat(device).as("No devices").isNotNull();
        assertThat(device.getMachineId()).as("No machineId for " + device.getId()).isNotBlank();
        device = DeviceApi.getDevice(device.getMachineId());
        assertThat(device.getHostname()).as("No hostname for " + device.getId()).isNotBlank();
        final String hostname = device.getHostname();
        assertThat(device.getId()).as("No id for " + hostname).isNotBlank();
        assertThat(device.getAgentVersion()).as("No agentVersion for " + hostname).isNotBlank();
        assertThat(device.getStatus()).as("No status for " + hostname).isNotNull();
        assertThat(device.getLastSeen()).as("No lastSeen for " + hostname).isNotBlank();
        assertThat(device.getType()).as("No type for " + hostname).isNotNull();
        assertThat(device.getOsType()).as("No osType for " + hostname).isNotBlank();
        assertThat(device.getRegisteredAt()).as("No registeredAt for " + hostname).isNotBlank();
        assertThat(device.getUpdatedAt()).as("No updatedAt for " + hostname).isNotBlank();
        assertThat(device.getOrganizationId()).as("No organizationId for " + hostname).isNotBlank();
        assertThat(device.getToolConnections()).as("No toolConnections for " + hostname).isNotEmpty().hasSize(3);
        assertThat(device.getToolConnections()).allSatisfy(toolConnection -> {
            assertThat(toolConnection.getToolType()).as("No toolType for " + hostname).isNotEmpty();
            assertThat(toolConnection.getAgentToolId()).as("No agentToolId for " + hostname).isNotEmpty();
            assertThat(toolConnection.getStatus()).as("No status for " + hostname).isNotNull();
        });
        assertThat(device.getInstalledAgents()).as("No installedAgents for " + hostname).isNotEmpty().hasSize(5);
        assertThat(device.getInstalledAgents()).allSatisfy(agent -> {
            assertThat(agent.getAgentType()).as("No agentType for " + hostname).isNotEmpty();
            assertThat(agent.getVersion()).as("No version for " + hostname).isNotEmpty();
        });
    }

    @Tag("read")
    @Test
    @DisplayName("Get fleet info")
    public void testFleetInfo() {
        Machine device = DeviceApi.getAnyDevice(onlineDevicesFilter(), offlineDevicesFilter());
        assertThat(device).as("No devices").isNotNull();
        device = DeviceApi.getDevice(device.getMachineId());
        String fleetId = getFleetId(device);
        assertThat(fleetId).as("No fleetId for " + device.getHostname()).isNotBlank();
        FleetHost fleet = DeviceApi.getFleetInfo(fleetId);
        assertThat(fleet).as("No fleet info for fleetId " + fleetId).isNotNull();
        assertThat(fleet.getComputerName()).as("No computerName for " + fleetId).isNotBlank();
        String name = fleet.getComputerName();

        // Hardware
        assertThat(fleet.getHardwareVendor()).as("No hardwareVendor for " + name).isNotBlank();
        assertThat(fleet.getHardwareModel()).as("No hardwareModel for " + name).isNotBlank();
        assertThat(fleet.getHardwareSerial()).as("No hardwareSerial for " + name).isNotBlank();
        assertThat(fleet.getCpuType()).as("No cpuType for " + name).isNotBlank();
        assertThat(fleet.getCpuSubtype()).as("No cpuSubtype for " + name).isNotBlank();
        assertThat(fleet.getCpuBrand()).as("No cpuBrand for " + name).isNotBlank();
        assertThat(fleet.getCpuPhysicalCores()).as("No cpuPhysicalCores for " + name).isGreaterThan(0);
        assertThat(fleet.getCpuLogicalCores()).as("No cpuLogicalCores for " + name).isGreaterThan(0);
        assertThat(fleet.getMemory()).as("No memory for " + name).isGreaterThan(0);
        assertThat(fleet.getUptime()).as("No uptime for " + name).isGreaterThan(0);
        assertThat(fleet.getGigsTotalDiskSpace()).as("No gigsTotalDiskSpace for " + name).isGreaterThan(0);

        // Users
        assertThat(fleet.getUsers()).as("No users for " + name).isNotEmpty();
        assertThat(fleet.getUsers()).allSatisfy(user -> {
            assertThat(user.getUsername()).as("No username for " + name).isNotBlank();
        });

        // Software
        assertThat(fleet.getSoftware()).as("No software for " + name).isNotEmpty();
        assertThat(fleet.getSoftware()).allSatisfy(sw -> {
            assertThat(sw.getName()).as("No software name for " + name).isNotBlank();
        });

        // Vulnerabilities
        if (!fleet.getVulnerabilities().isEmpty()) {
            assertThat(fleet.getVulnerabilities()).as("No vulnerabilities for " + name).isNotEmpty();
            assertThat(fleet.getVulnerabilities()).allSatisfy(vuln -> {
                assertThat(vuln.getCve()).as("No cve for " + name).isNotBlank();
                assertThat(vuln.getDetailsLink()).as("No detailsLink for " + name).isNotBlank();
                assertThat(vuln.getCreatedAt()).as("No createdAt for " + name).isNotBlank();
                assertThat(vuln.getSoftwareName()).as("No softwareName for " + name).isNotBlank();
            });
        }
    }

    @Tag("read")
    @Test
    @DisplayName("Search device by hostname")
    public void testSearchDevices() {
        List<String> hostnames = DeviceApi.getDeviceHostnames(listedStatusesDevicesFilter());
        assertThat(hostnames).as("Expected at least one device with hostname").isNotEmpty();
        Machine device = DeviceApi.searchDevice(listedStatusesDevicesFilter(), hostnames.getFirst());
        assertThat(device).as("Searched device should not be null").isNotNull();
        assertThat(device.getHostname()).as("Searched device hostname should match").isEqualTo(hostnames.getFirst());
    }

    @Tag("read")
    @Test
    @DisplayName("Filter devices by OS")
    public void testFilterDevices() {
        List<Machine> devices = DeviceApi.getDevices(osDevicesFilter("WINDOWS"));
        assertThat(devices).as("No WINDOWS devices").isNotEmpty();
        assertThat(devices).allSatisfy(device -> {
            assertThat(device.getOsType()).as("Device osType should be WINDOWS").isEqualTo("WINDOWS");
        });
    }

    @Tag("update")
    @Test
    @DisplayName("Archive device")
    public void testArchiveDevice() {
        List<Machine> devices = DeviceApi.getDevices(offlineDevicesFilter());
        assertThat(devices).as("Expected at least one OFFLINE device to archive").isNotEmpty();
        DeviceApi.archiveDevice(devices.getLast());
        List<String> ids = DeviceApi.getDeviceIds(listedStatusesDevicesFilter());
        assertThat(ids).as("Archived device should not be in listed devices").doesNotContain(devices.getFirst().getMachineId());
    }

    @Tag("delete")
    @Test
    @DisplayName("Delete device")
    public void testDeleteDevice() {
        List<Machine> devices = DeviceApi.getDevices(offlineDevicesFilter());
        assertThat(devices).as("Expected at least one OFFLINE device to delete").isNotEmpty();
        DeviceApi.deleteDevice(devices.getLast());
        List<String> ids = DeviceApi.getDeviceIds(listedStatusesDevicesFilter());
        assertThat(ids).as("Deleted device should not be in listed devices").doesNotContain(devices.getFirst().getMachineId());
    }
}
