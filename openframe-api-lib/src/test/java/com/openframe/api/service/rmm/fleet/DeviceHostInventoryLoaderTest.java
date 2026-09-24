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
import com.openframe.sdk.fleetmdm.model.HostSearchRequest;
import com.openframe.sdk.fleetmdm.model.HostSoftwareResponse;
import com.openframe.sdk.fleetmdm.model.HostSoftwareTitle;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

import static com.openframe.api.service.rmm.fleet.HostInventoryFixtures.hostSoftware;
import static com.openframe.api.service.rmm.fleet.HostInventoryFixtures.title;
import static com.openframe.api.service.rmm.fleet.HostInventoryFixtures.vulnerability;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceHostInventoryLoaderTest {

    private static final String MACHINE_ID = "machine-1";
    private static final String TENANT_ID = "tenant-1";
    private static final String OS_UUID = "os-uuid-1";
    private static final long HOST_ID = 42L;
    private static final int FETCH_PAGE_SIZE = 500;
    private static final String CVE_A = "CVE-2024-0001";

    @Mock private FleetMdmClient fleet;
    @Mock private DeviceService deviceService;
    @Mock private FleetHostMachineResolver hostMachineResolver;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private CorrelatedHostSoftwareCache hostSoftwareCache;

    @Captor private ArgumentCaptor<Function<HostSearchRequest, List<Host>>> hostSearchCaptor;

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
        NotFoundException ex = assertThrows(NotFoundException.class, () -> loader.load(fleet, MACHINE_ID));

        // verifications
        assertThat(ex.getMessage()).contains(MACHINE_ID);
    }

    @Test
    void load_machineWithoutFleetIdentifiers_emptyInventoryWithoutFleetCalls() {
        // setup
        machine.setOsUuid(null);
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        HostInventory inventory = loader.load(fleet, MACHINE_ID);

        // verifications
        assertThat(inventory.getTitles()).isEmpty();
        verifyNoInteractions(fleet);
    }

    @Test
    void load_noCorrelatedFleetHost_emptyInventoryWithoutInventoryCalls() {
        // setup
        Machine otherMachine = new Machine();
        otherMachine.setMachineId("machine-2");
        stubMachineLookup();
        when(hostMachineResolver.resolve(TENANT_ID, List.of(host))).thenReturn(Map.of(HOST_ID, otherMachine));

        // execution
        HostInventory inventory = loader.load(fleet, MACHINE_ID);

        // verifications
        assertThat(inventory.getTitles()).isEmpty();
        verify(fleet, never()).listHostSoftware(HOST_ID, 0, FETCH_PAGE_SIZE);
        verifyNoInteractions(hostSoftwareCache);
    }

    @Test
    void load_correlatedHost_titlesJoinedWithCachedHostSoftwareCveDetails() {
        // setup
        stubCorrelatedHost();
        stubHostSoftwarePage(0, false, title(10L, "Google Chrome", "apps", "120.0", CVE_A));
        stubCorrelatedSoftware(hostSoftware("Google Chrome", "120.0", vulnerability(CVE_A, 9.8, null)));

        // execution
        HostInventory inventory = loader.load(fleet, MACHINE_ID);

        // verifications
        assertThat(inventory.getTitles()).extracting(HostSoftwareTitle::getName).containsExactly("Google Chrome");
        CveHit hit = inventory.hits().findFirst().orElseThrow();
        assertThat(inventory.detail(hit)).map(FleetVulnerability::getCvssScore).contains(9.8);
    }

    @Test
    void load_correlatedHost_softwareCacheFilledThroughCallersFleetClient() {
        // setup
        stubCorrelatedHost();
        stubHostSoftwarePage(0, false, title(10L, "Google Chrome", "apps", "120.0"));
        stubCorrelatedSoftware();
        HostSearchRequest request = new HostSearchRequest();

        // execution
        loader.load(fleet, MACHINE_ID);

        // verifications
        verify(hostSoftwareCache).softwareByHostId(hostSearchCaptor.capture());
        hostSearchCaptor.getValue().apply(request);
        verify(fleet).searchHosts(request);
    }

    @Test
    void load_hostAbsentFromSoftwareCache_titlesKeptWithoutCveDetails() {
        // setup
        stubCorrelatedHost();
        stubHostSoftwarePage(0, false, title(10L, "Google Chrome", "apps", "120.0", CVE_A));
        when(hostSoftwareCache.softwareByHostId(any())).thenReturn(Map.of());

        // execution
        HostInventory inventory = loader.load(fleet, MACHINE_ID);

        // verifications
        assertThat(inventory.getTitles()).extracting(HostSoftwareTitle::getName).containsExactly("Google Chrome");
        CveHit hit = inventory.hits().findFirst().orElseThrow();
        assertThat(inventory.detail(hit)).isEmpty();
    }

    @Test
    void load_titlesSpanTwoPages_allPagesCollected() {
        // setup
        stubCorrelatedHost();
        stubHostSoftwarePage(0, true, title(10L, "Google Chrome", "apps", "120.0"));
        stubHostSoftwarePage(1, false, title(11L, "node", "homebrew_packages", "20.1"));
        stubCorrelatedSoftware();

        // execution
        HostInventory inventory = loader.load(fleet, MACHINE_ID);

        // verifications
        assertThat(inventory.getTitles())
                .extracting(HostSoftwareTitle::getName)
                .containsExactly("Google Chrome", "node");
    }

    private void stubMachineLookup() {
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
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

    private void stubCorrelatedSoftware(FleetSoftware... software) {
        when(hostSoftwareCache.softwareByHostId(any())).thenReturn(Map.of(HOST_ID, List.of(software)));
    }
}
