package com.openframe.api.service.rmm.fleet;

import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.fleet.HostInventory.CveHit;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.device.Machine;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.model.FleetSoftware;
import com.openframe.sdk.fleetmdm.model.FleetVulnerability;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostSoftwareResponse;
import com.openframe.sdk.fleetmdm.model.HostSoftwareTitle;
import com.openframe.sdk.fleetmdm.model.HostVulnerabilityInventory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.openframe.api.service.rmm.fleet.HostInventoryFixtures.hostSoftware;
import static com.openframe.api.service.rmm.fleet.HostInventoryFixtures.title;
import static com.openframe.api.service.rmm.fleet.HostInventoryFixtures.vulnerability;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceHostInventoryLoaderTest {

    private static final String MACHINE_ID = "machine-1";
    private static final String TENANT_ID = "tenant-1";
    private static final String OS_UUID = "os-uuid-1";
    private static final long HOST_ID = 42L;
    private static final int FETCH_PAGE_SIZE = 500;
    private static final String CVE_A = "CVE-2024-0001";

    @Mock private FleetMdmClientProvider fleetClientProvider;
    @Mock private FleetMdmClient fleet;
    @Mock private DeviceService deviceService;
    @Mock private FleetHostMachineResolver hostMachineResolver;
    @Mock private TenantIdProvider tenantIdProvider;

    @InjectMocks private DeviceHostInventoryLoader loader;

    private Machine machine;
    private Host host;

    @BeforeEach
    void setUp() {
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setOsUuid(OS_UUID);
        host = new Host();
        host.setId(HOST_ID);
        host.setUuid(OS_UUID);
    }

    @Test
    void load_unknownMachine_throwsNotFound() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        NotFoundException ex = assertThrows(NotFoundException.class, () -> loader.load(MACHINE_ID));

        // verifications
        assertThat(ex.getMessage()).contains(MACHINE_ID);
    }

    @Test
    void load_machineWithoutFleetIdentifiers_emptyInventoryWithoutFleetSearch() {
        // setup
        machine.setOsUuid(null);
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        HostInventory inventory = loader.load(MACHINE_ID);

        // verifications
        assertThat(inventory.getTitles()).isEmpty();
        verify(fleetClientProvider, never()).client();
    }

    @Test
    void load_noCorrelatedFleetHost_emptyInventoryWithoutInventoryCalls() {
        // setup
        Machine otherMachine = new Machine();
        otherMachine.setMachineId("machine-2");
        stubMachineLookup();
        when(hostMachineResolver.resolve(TENANT_ID, List.of(host))).thenReturn(Map.of(HOST_ID, otherMachine));

        // execution
        HostInventory inventory = loader.load(MACHINE_ID);

        // verifications
        assertThat(inventory.getTitles()).isEmpty();
        verify(fleet, never()).listHostSoftware(HOST_ID, 0, FETCH_PAGE_SIZE);
        verify(fleet, never()).getHostVulnerabilityInventoryById(HOST_ID);
    }

    @Test
    void load_correlatedHost_titlesJoinedWithHostCveDetails() {
        // setup
        stubCorrelatedHost();
        stubHostSoftwarePage(0, false, title(10L, "Google Chrome", "apps", "120.0", CVE_A));
        stubHostDetails(hostSoftware("Google Chrome", "120.0", vulnerability(CVE_A, 9.8, null)));

        // execution
        HostInventory inventory = loader.load(MACHINE_ID);

        // verifications
        assertThat(inventory.getTitles()).extracting(HostSoftwareTitle::getName).containsExactly("Google Chrome");
        CveHit hit = inventory.hits().findFirst().orElseThrow();
        assertThat(inventory.detail(hit)).map(FleetVulnerability::getCvssScore).contains(9.8);
    }

    @Test
    void load_titlesSpanTwoPages_allPagesCollected() {
        // setup
        stubCorrelatedHost();
        stubHostSoftwarePage(0, true, title(10L, "Google Chrome", "apps", "120.0"));
        stubHostSoftwarePage(1, false, title(11L, "node", "homebrew_packages", "20.1"));
        stubHostDetails();

        // execution
        HostInventory inventory = loader.load(MACHINE_ID);

        // verifications
        assertThat(inventory.getTitles())
                .extracting(HostSoftwareTitle::getName)
                .containsExactly("Google Chrome", "node");
    }

    private void stubMachineLookup() {
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(fleetClientProvider.client()).thenReturn(fleet);
        when(fleet.searchHosts(OS_UUID)).thenReturn(List.of(host));
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
    }

    private void stubCorrelatedHost() {
        stubMachineLookup();
        when(hostMachineResolver.resolve(TENANT_ID, List.of(host))).thenReturn(Map.of(HOST_ID, machine));
    }

    private void stubHostSoftwarePage(int page, boolean hasNext, HostSoftwareTitle... titles) {
        HostSoftwareResponse.Meta meta = new HostSoftwareResponse.Meta();
        meta.setHasNextResults(hasNext);
        HostSoftwareResponse response = new HostSoftwareResponse();
        response.setSoftware(List.of(titles));
        response.setMeta(meta);
        when(fleet.listHostSoftware(HOST_ID, page, FETCH_PAGE_SIZE)).thenReturn(response);
    }

    private void stubHostDetails(FleetSoftware... software) {
        HostVulnerabilityInventory inventory = new HostVulnerabilityInventory(HOST_ID, "host-1", null, List.of(software));
        when(fleet.getHostVulnerabilityInventoryById(HOST_ID)).thenReturn(inventory);
    }
}
