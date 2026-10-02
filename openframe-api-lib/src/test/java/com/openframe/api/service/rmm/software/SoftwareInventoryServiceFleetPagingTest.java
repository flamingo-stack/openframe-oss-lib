package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareFilters;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceResponse;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilityResponse;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.service.rmm.fleet.DeviceHostInventoryLoader;
import com.openframe.api.service.rmm.fleet.FleetDeviceCountEnricher;
import com.openframe.api.service.rmm.fleet.FleetHostMachineResolver;
import com.openframe.api.service.rmm.fleet.HostInventory;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.model.FleetSoftware;
import com.openframe.sdk.fleetmdm.model.FleetVulnerability;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostSearchRequest;
import com.openframe.sdk.fleetmdm.model.SoftwareTitle;
import com.openframe.sdk.fleetmdm.model.SoftwareTitleRequest;
import com.openframe.sdk.fleetmdm.model.SoftwareTitleVersion;
import com.openframe.sdk.fleetmdm.model.SoftwareTitlesResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static com.openframe.api.service.rmm.fleet.HostInventoryFixtures.title;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareInventoryServiceFleetPagingTest {

    private static final String MACHINE_ID = "machine-1";

    @Mock private FleetMdmClient fleet;
    @Mock private FleetDeviceCountEnricher deviceCountEnricher;
    @Mock private FleetHostMachineResolver hostMachineResolver;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private IntegratedToolRepository integratedToolRepository;
    @Mock private DeviceHostInventoryLoader deviceHostInventoryLoader;

    private SoftwareInventoryService service;

    @BeforeEach
    void setUp() {
        service = new SoftwareInventoryService(integratedToolRepository, deviceCountEnricher, hostMachineResolver,
                tenantIdProvider, deviceHostInventoryLoader);
        ReflectionTestUtils.setField(service, "fleet", fleet);
        ReflectionTestUtils.setField(service, "fleetPaging", true);
    }

    @Test
    void listSoftware_onePageFromFleet_pagingSearchAndDevicesSortGoToFleet() {
        // setup
        SoftwareTitle chrome = fleetTitle("Chrome", 42L, 31);
        ArgumentCaptor<SoftwareTitleRequest> request = ArgumentCaptor.forClass(SoftwareTitleRequest.class);
        when(fleet.listSoftwareTitles(request.capture())).thenReturn(titlesPage(45, true, chrome));

        // execution
        PageResult<SoftwareResponse> result = service.listSoftware("chr", 2, 20, sort("devicesCount", SortDirection.DESC), true);

        // verifications
        assertThat(request.getValue())
                .extracting(SoftwareTitleRequest::getPage, SoftwareTitleRequest::getPerPage, SoftwareTitleRequest::getQuery,
                        SoftwareTitleRequest::getVulnerable, SoftwareTitleRequest::getOrderKey,
                        SoftwareTitleRequest::getOrderDirection)
                .containsExactly(2, 20, "chr", true, "hosts_count", "desc");
        assertThat(result.items()).extracting(SoftwareResponse::getId, SoftwareResponse::getDevicesCount)
                .containsExactly(tuple("42", 31));
        assertThat(result.filteredCount()).isEqualTo(45);
        assertThat(result.hasNext()).isTrue();
        assertThat(result.hasPrevious()).isTrue();
        verifyNoInteractions(deviceCountEnricher);
    }

    @Test
    void listSoftware_cveCountSort_leftToFleetDefaultOrder() {
        // setup
        ArgumentCaptor<SoftwareTitleRequest> request = ArgumentCaptor.forClass(SoftwareTitleRequest.class);
        when(fleet.listSoftwareTitles(request.capture())).thenReturn(titlesPage(0, false));

        // execution
        service.listSoftware(null, 0, 20, sort("cveCount", SortDirection.DESC), null);

        // verifications
        assertThat(request.getValue().getOrderKey()).isNull();
        assertThat(request.getValue().getOrderDirection()).isNull();
    }

    @Test
    void getSoftwareFilters_emptyFacetsWithoutFleet() {
        // execution
        SoftwareFilters filters = service.getSoftwareFilters(null);

        // verifications
        assertThat(filters.getSources()).isEmpty();
        assertThat(filters.getVersionStatuses()).isEmpty();
        assertThat(filters.getSeverities()).isEmpty();
        verifyNoInteractions(fleet);
    }

    @Test
    void findById_devicesCountIsFleetsCount() {
        // setup
        when(fleet.getSoftwareTitle(42L)).thenReturn(fleetTitle("Chrome", 42L, 7));

        // execution + verifications
        assertThat(service.findById("42")).map(SoftwareResponse::getDevicesCount).contains(7);
        verifyNoInteractions(deviceCountEnricher);
    }

    @Test
    void listVulnerabilitiesForSoftware_detailsPerVersion_earliestDiscoveryWins() {
        // setup
        SoftwareTitle chrome = fleetTitle("Chrome", 42L, 2);
        chrome.setVersions(List.of(versionWithCve(1L, "1.0", "CVE-A"), versionWithCve(2L, "2.0", "CVE-A")));
        when(fleet.getSoftwareTitle(42L)).thenReturn(chrome);
        when(fleet.getSoftwareVersion(1L)).thenReturn(versionDetails(cveFound("CVE-A", "2026-09-02T00:00:00Z")));
        when(fleet.getSoftwareVersion(2L)).thenReturn(versionDetails(cveFound("CVE-A", "2026-09-01T00:00:00Z")));

        // execution
        PageResult<SoftwareVulnerabilityResponse> result =
                service.listVulnerabilitiesForSoftware("42", null, 0, 50, null, true);

        // verifications
        assertThat(result.items())
                .extracting(SoftwareVulnerabilityResponse::getCveId, SoftwareVulnerabilityResponse::getAffectedVersion,
                        row -> row.getDiscoveredAt().toString())
                .containsExactly(tuple("CVE-A", "1.0, 2.0", "2026-09-01T00:00:00Z"));
        verify(fleet, never()).getVulnerability(anyString());
    }

    @Test
    void listVulnerabilitiesForSoftware_versionGoneFromFleet_rowWithoutDetails() {
        // setup
        SoftwareTitle setuptools = fleetTitle("setuptools", 42L, 1);
        setuptools.setVersions(List.of(versionWithCve(1L, "58.0.4", "CVE-2026-00000")));
        when(fleet.getSoftwareTitle(42L)).thenReturn(setuptools);
        when(fleet.getSoftwareVersion(1L)).thenReturn(null);

        // execution
        PageResult<SoftwareVulnerabilityResponse> result =
                service.listVulnerabilitiesForSoftware("42", null, 0, 50, null, true);

        // verifications
        assertThat(result.items()).extracting(SoftwareVulnerabilityResponse::getCveId, SoftwareVulnerabilityResponse::getDiscoveredAt)
                .containsExactly(tuple("CVE-2026-00000", null));
    }

    @Test
    void listDevicesForSoftware_hostsOfEveryVersionCorrelated() {
        // setup
        SoftwareTitle chrome = fleetTitle("Chrome", 42L, 2);
        chrome.setVersions(List.of(versionWithCve(10L, "1.0"), versionWithCve(11L, "2.0")));
        when(fleet.getSoftwareTitle(42L)).thenReturn(chrome);
        when(fleet.searchHosts(any(HostSearchRequest.class)))
                .thenAnswer(inv -> List.of(host(((HostSearchRequest) inv.getArgument(0)).getSoftwareVersionId())));
        when(tenantIdProvider.getTenantId()).thenReturn("t1");
        when(hostMachineResolver.resolve(eq("t1"), anyList())).thenReturn(Map.of(10L, machine("m-10"), 11L, machine("m-11")));

        // execution
        PageResult<SoftwareOnDeviceResponse> result = service.listDevicesForSoftware("42", null, null, 0, 50);

        // verifications
        assertThat(result.items())
                .extracting(row -> row.getDevice().getMachineId(), SoftwareOnDeviceResponse::getSoftwareVersion)
                .containsExactly(tuple("m-10", "1.0"), tuple("m-11", "2.0"));
    }

    @Test
    void listSoftwareForDevice_devicesCountReadForPageRowsOnly() {
        // setup
        when(deviceHostInventoryLoader.load(fleet, MACHINE_ID)).thenReturn(HostInventory.of(
                List.of(title(10L, "Google Chrome", "apps", "120.0"),
                        title(11L, "node", "homebrew_packages", "20.1"),
                        title(12L, "zsh", "homebrew_packages", "5.9")),
                List.of()));
        when(fleet.getSoftwareTitle(10L)).thenReturn(fleetTitle("Google Chrome", 10L, 4));
        when(fleet.getSoftwareTitle(11L)).thenReturn(fleetTitle("node", 11L, 9));

        // execution
        PageResult<SoftwareResponse> result = service.listSoftwareForDevice(MACHINE_ID, null, null, 0, 2, null);

        // verifications
        assertThat(result.items())
                .extracting(SoftwareResponse::getName, SoftwareResponse::getDevicesCount)
                .containsExactly(tuple("Google Chrome", 4), tuple("node", 9));
        assertThat(result.filteredCount()).isEqualTo(3);
        verify(fleet, never()).getSoftwareTitle(12L);
        verify(fleet, never()).listSoftwareTitles(any(SoftwareTitleRequest.class));
        verifyNoInteractions(deviceCountEnricher);
    }

    @Test
    void listSoftwareForDevice_emptyInventory_noFleetLookups() {
        // setup
        when(deviceHostInventoryLoader.load(fleet, MACHINE_ID)).thenReturn(HostInventory.empty());

        // execution
        PageResult<SoftwareResponse> result = service.listSoftwareForDevice(MACHINE_ID, null, null, 0, 20, null);

        // verifications
        assertThat(result.items()).isEmpty();
        verify(fleet, never()).getSoftwareTitle(anyLong());
    }

    private static SortInput sort(String field, SortDirection direction) {
        SortInput sort = new SortInput();
        sort.setField(field);
        sort.setDirection(direction);
        return sort;
    }

    private static SoftwareTitle fleetTitle(String name, Long id, int hostsCount) {
        SoftwareTitle title = new SoftwareTitle();
        title.setId(id);
        title.setName(name);
        title.setHostsCount(hostsCount);
        title.setVersions(List.of());
        return title;
    }

    private static SoftwareTitleVersion versionWithCve(Long id, String version, String... cves) {
        SoftwareTitleVersion titleVersion = new SoftwareTitleVersion();
        titleVersion.setId(id);
        titleVersion.setVersion(version);
        titleVersion.setVulnerabilities(List.of(cves));
        return titleVersion;
    }

    private static FleetSoftware versionDetails(FleetVulnerability... cves) {
        FleetSoftware software = new FleetSoftware();
        software.setVulnerabilities(List.of(cves));
        return software;
    }

    private static FleetVulnerability cveFound(String cve, String createdAt) {
        FleetVulnerability vulnerability = new FleetVulnerability();
        vulnerability.setCve(cve);
        vulnerability.setCreatedAt(createdAt);
        return vulnerability;
    }

    private static SoftwareTitlesResponse titlesPage(int count, boolean hasNext, SoftwareTitle... titles) {
        SoftwareTitlesResponse.Meta meta = new SoftwareTitlesResponse.Meta();
        meta.setHasNextResults(hasNext);
        SoftwareTitlesResponse response = new SoftwareTitlesResponse();
        response.setSoftwareTitles(List.of(titles));
        response.setCount(count);
        response.setMeta(meta);
        return response;
    }

    private static Host host(long id) {
        Host host = new Host();
        host.setId(id);
        return host;
    }

    private static Machine machine(String machineId) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        return machine;
    }
}
