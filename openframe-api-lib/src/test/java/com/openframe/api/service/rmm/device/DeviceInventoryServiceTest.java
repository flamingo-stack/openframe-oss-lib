package com.openframe.api.service.rmm.device;

import com.openframe.api.dto.rmm.software.SoftwareCveSeverity;
import com.openframe.api.dto.rmm.software.SoftwareFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareSource;
import com.openframe.api.dto.rmm.vulnerability.AffectedSoftwareResponse;
import com.openframe.api.dto.rmm.vulnerability.VulnerabilityFilterInput;
import com.openframe.api.dto.rmm.vulnerability.VulnerabilityResponse;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.fleet.FleetDeviceCountEnricher;
import com.openframe.api.service.rmm.fleet.FleetHostMachineResolver;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.model.FleetSoftware;
import com.openframe.sdk.fleetmdm.model.FleetVulnerability;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostSoftwareInstalledVersion;
import com.openframe.sdk.fleetmdm.model.HostSoftwareResponse;
import com.openframe.sdk.fleetmdm.model.HostSoftwareTitle;
import com.openframe.sdk.fleetmdm.model.HostVulnerabilityInventory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.BiConsumer;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceInventoryServiceTest {

    private static final String MACHINE_ID = "machine-1";
    private static final String TENANT_ID = "tenant-1";
    private static final String OS_UUID = "os-uuid-1";
    private static final long HOST_ID = 42L;
    private static final int FIRST_PAGE = 0;
    private static final int FETCH_PAGE_SIZE = 500;

    private static final String CVE_CRITICAL = "CVE-2024-0001";
    private static final String CVE_MEDIUM = "CVE-2024-0002";
    private static final String CVE_UNRATED = "CVE-2024-0003";

    @Mock private FleetMdmClient fleet;
    @Mock private DeviceService deviceService;
    @Mock private FleetHostMachineResolver hostMachineResolver;
    @Mock private FleetDeviceCountEnricher deviceCountEnricher;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private IntegratedToolRepository integratedToolRepository;

    @Captor private ArgumentCaptor<List<SoftwareResponse>> softwareRowsCaptor;

    @InjectMocks private DeviceInventoryService service;

    private Machine machine;
    private Host host;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "fleet", fleet);
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setOsUuid(OS_UUID);
        host = new Host();
        host.setId(HOST_ID);
        host.setUuid(OS_UUID);
    }

    @Test
    void listVulnerabilities_unknownMachine_throwsNotFound() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        NotFoundException ex = assertThrows(NotFoundException.class,
                () -> service.listVulnerabilities(MACHINE_ID, null, null, FIRST_PAGE, 50, null));

        // verifications
        assertThat(ex.getMessage()).contains(MACHINE_ID);
    }

    @Test
    void listVulnerabilities_noCorrelatedFleetHost_emptyPageWithoutInventoryCalls() {
        // setup
        Machine otherMachine = new Machine();
        otherMachine.setMachineId("machine-2");
        stubMachineLookup();
        when(hostMachineResolver.resolve(TENANT_ID, List.of(host))).thenReturn(Map.of(HOST_ID, otherMachine));

        // execution
        PageResult<VulnerabilityResponse> result =
                service.listVulnerabilities(MACHINE_ID, null, null, FIRST_PAGE, 50, null);

        // verifications
        assertThat(result.items()).isEmpty();
        assertThat(result.filteredCount()).isZero();
        verify(fleet, never()).listHostSoftware(HOST_ID, FIRST_PAGE, FETCH_PAGE_SIZE);
        verify(fleet, never()).getHostVulnerabilityInventoryById(HOST_ID);
    }

    @Test
    void listVulnerabilities_cveSharedByTwoTitles_singleRowListsBothAsAffected() {
        // setup
        stubCorrelatedHost();
        stubHostSoftware(
                title(10L, "Google Chrome", "apps", "120.0", CVE_CRITICAL, CVE_MEDIUM),
                title(11L, "node", "homebrew_packages", "20.1", CVE_CRITICAL));
        stubHostDetails(
                hostSoftware("Google Chrome", "120.0", vulnerability(CVE_CRITICAL, 9.8, null),
                        vulnerability(CVE_MEDIUM, 5.0, null)),
                hostSoftware("node", "20.1", vulnerability(CVE_CRITICAL, 9.8, "21.0")));

        // execution
        PageResult<VulnerabilityResponse> result =
                service.listVulnerabilities(MACHINE_ID, null, null, FIRST_PAGE, 50, null);

        // verifications
        assertThat(result.items())
                .extracting(VulnerabilityResponse::getCveId, VulnerabilityResponse::getSeverity)
                .containsExactly(
                        tuple(CVE_CRITICAL, SoftwareCveSeverity.CRITICAL),
                        tuple(CVE_MEDIUM, SoftwareCveSeverity.MEDIUM));
        assertThat(result.items())
                .flatExtracting(VulnerabilityResponse::getAffectedSoftware)
                .extracting(AffectedSoftwareResponse::getId, AffectedSoftwareResponse::getName,
                        AffectedSoftwareResponse::getSource, AffectedSoftwareResponse::getVersion,
                        AffectedSoftwareResponse::getResolvedInVersion)
                .containsExactly(
                        tuple("10", "Google Chrome", SoftwareSource.UNMANAGED, "120.0", null),
                        tuple("11", "node", SoftwareSource.BREW, "20.1", "21.0"),
                        tuple("10", "Google Chrome", SoftwareSource.UNMANAGED, "120.0", null));
    }

    @Test
    void listVulnerabilities_defaultOrder_cvssDescendingUnratedLast() {
        // setup
        stubCorrelatedHost();
        stubHostSoftware(title(10L, "Google Chrome", "apps", "120.0", CVE_UNRATED, CVE_MEDIUM, CVE_CRITICAL));
        stubHostDetails(hostSoftware("Google Chrome", "120.0",
                vulnerability(CVE_MEDIUM, 5.0, null), vulnerability(CVE_CRITICAL, 9.8, null)));

        // execution
        PageResult<VulnerabilityResponse> result =
                service.listVulnerabilities(MACHINE_ID, null, null, FIRST_PAGE, 50, null);

        // verifications
        assertThat(result.items())
                .extracting(VulnerabilityResponse::getCveId)
                .containsExactly(CVE_CRITICAL, CVE_MEDIUM, CVE_UNRATED);
    }

    @Test
    void listVulnerabilities_minSeverityHigh_unratedAndLowerBandsExcluded() {
        // setup
        stubCorrelatedHost();
        stubHostSoftware(title(10L, "Google Chrome", "apps", "120.0", CVE_UNRATED, CVE_MEDIUM, CVE_CRITICAL));
        stubHostDetails(hostSoftware("Google Chrome", "120.0",
                vulnerability(CVE_MEDIUM, 5.0, null), vulnerability(CVE_CRITICAL, 9.8, null)));
        VulnerabilityFilterInput filter = new VulnerabilityFilterInput();
        filter.setMinSeverity(SoftwareCveSeverity.HIGH);

        // execution
        PageResult<VulnerabilityResponse> result =
                service.listVulnerabilities(MACHINE_ID, filter, null, FIRST_PAGE, 50, null);

        // verifications
        assertThat(result.items())
                .extracting(VulnerabilityResponse::getCveId)
                .containsExactly(CVE_CRITICAL);
        assertThat(result.filteredCount()).isEqualTo(1);
    }

    @Test
    void listVulnerabilities_searchByAffectedTitleName_matchesCaseInsensitively() {
        // setup
        stubCorrelatedHost();
        stubHostSoftware(
                title(10L, "Google Chrome", "apps", "120.0", CVE_CRITICAL),
                title(11L, "node", "homebrew_packages", "20.1", CVE_MEDIUM));
        stubHostDetails(
                hostSoftware("Google Chrome", "120.0", vulnerability(CVE_CRITICAL, 9.8, null)),
                hostSoftware("node", "20.1", vulnerability(CVE_MEDIUM, 5.0, null)));

        // execution
        PageResult<VulnerabilityResponse> result =
                service.listVulnerabilities(MACHINE_ID, null, "chrome", FIRST_PAGE, 50, null);

        // verifications
        assertThat(result.items())
                .extracting(VulnerabilityResponse::getCveId)
                .containsExactly(CVE_CRITICAL);
    }

    @Test
    void listVulnerabilities_unknownSortField_throwsBadRequestBeforeAnyLookup() {
        // setup
        SortInput sort = SortInput.builder().field("devicesCount").build();

        // execution
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.listVulnerabilities(MACHINE_ID, null, null, FIRST_PAGE, 50, sort));

        // verifications
        assertThat(ex.getMessage()).contains("devicesCount").contains("severity, discoveredAt");
        verify(deviceService, never()).findByMachineId(MACHINE_ID);
    }

    @Test
    void listSoftware_titleWithCves_rowCarriesInstalledVersionAndHostScopedSummary() {
        // setup
        stubCorrelatedHost();
        stubHostSoftware(title(11L, "node", "homebrew_packages", "20.1", CVE_CRITICAL, CVE_MEDIUM));
        stubHostDetails(hostSoftware("node", "20.1",
                vulnerability(CVE_CRITICAL, 9.8, null), vulnerability(CVE_MEDIUM, 5.0, null)));

        // execution
        PageResult<SoftwareResponse> result = service.listSoftware(MACHINE_ID, null, null, FIRST_PAGE, 50, null);

        // verifications
        assertThat(result.items())
                .extracting(SoftwareResponse::getId, SoftwareResponse::getName, SoftwareResponse::getSource,
                        SoftwareResponse::getCurrentVersion, SoftwareResponse::getOlderVersionsCount)
                .containsExactly(tuple("11", "node", SoftwareSource.BREW, "20.1", 0));
        assertThat(result.items())
                .extracting(row -> row.getVulnerabilitySummary().getCveCount(),
                        row -> row.getVulnerabilitySummary().getHighestSeverity())
                .containsExactly(tuple(2, SoftwareCveSeverity.CRITICAL));
    }

    @Test
    void listSoftware_titleWithoutCves_summaryIsNull() {
        // setup
        stubCorrelatedHost();
        stubHostSoftware(title(11L, "node", "homebrew_packages", "20.1"));
        stubHostDetails();

        // execution
        PageResult<SoftwareResponse> result = service.listSoftware(MACHINE_ID, null, null, FIRST_PAGE, 50, null);

        // verifications
        assertThat(result.items())
                .extracting(SoftwareResponse::getVulnerabilitySummary)
                .containsOnlyNulls();
    }

    @Test
    void listSoftware_sourcesFilter_keepsMatchingTitlesOnly() {
        // setup
        stubCorrelatedHost();
        stubHostSoftware(
                title(10L, "Google Chrome", "apps", "120.0"),
                title(11L, "node", "homebrew_packages", "20.1"));
        stubHostDetails();
        SoftwareFilterInput filter = new SoftwareFilterInput();
        filter.setSources(List.of(SoftwareSource.BREW));

        // execution
        PageResult<SoftwareResponse> result = service.listSoftware(MACHINE_ID, filter, null, FIRST_PAGE, 50, null);

        // verifications
        assertThat(result.items())
                .extracting(SoftwareResponse::getName)
                .containsExactly("node");
    }

    @Test
    void listSoftware_defaultOrder_byNameCaseInsensitive() {
        // setup
        stubCorrelatedHost();
        stubHostSoftware(
                title(12L, "zsh", "homebrew_packages", "5.9"),
                title(10L, "Google Chrome", "apps", "120.0"),
                title(11L, "node", "homebrew_packages", "20.1"));
        stubHostDetails();

        // execution
        PageResult<SoftwareResponse> result = service.listSoftware(MACHINE_ID, null, null, FIRST_PAGE, 50, null);

        // verifications
        assertThat(result.items())
                .extracting(SoftwareResponse::getName)
                .containsExactly("Google Chrome", "node", "zsh");
    }

    @Test
    void listSoftware_pageRequested_onlyPageItemsGetFleetWideDeviceCounts() {
        // setup
        stubCorrelatedHost();
        stubHostSoftware(
                title(10L, "Google Chrome", "apps", "120.0"),
                title(11L, "node", "homebrew_packages", "20.1"),
                title(12L, "zsh", "homebrew_packages", "5.9"));
        stubHostDetails();

        // execution
        PageResult<SoftwareResponse> result = service.listSoftware(MACHINE_ID, null, null, FIRST_PAGE, 2, null);

        // verifications
        assertThat(result.hasNext()).isTrue();
        assertThat(result.filteredCount()).isEqualTo(3);
        verify(deviceCountEnricher).enrich(softwareRowsCaptor.capture(), any(Function.class), any(BiConsumer.class));
        assertThat(softwareRowsCaptor.getValue())
                .extracting(SoftwareResponse::getName)
                .containsExactly("Google Chrome", "node");
    }

    @Test
    void listSoftware_unknownSortField_throwsBadRequestBeforeAnyLookup() {
        // setup
        SortInput sort = SortInput.builder().field("publisher").build();

        // execution
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.listSoftware(MACHINE_ID, null, null, FIRST_PAGE, 50, sort));

        // verifications
        assertThat(ex.getMessage()).contains("publisher").contains("name, cveCount, highestSeverity");
        verify(deviceService, never()).findByMachineId(MACHINE_ID);
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

    private void stubHostSoftware(HostSoftwareTitle... titles) {
        HostSoftwareResponse response = new HostSoftwareResponse();
        response.setSoftware(List.of(titles));
        when(fleet.listHostSoftware(HOST_ID, FIRST_PAGE, FETCH_PAGE_SIZE)).thenReturn(response);
    }

    private void stubHostDetails(FleetSoftware... software) {
        HostVulnerabilityInventory inventory = new HostVulnerabilityInventory(HOST_ID, "host-1", null, List.of(software));
        when(fleet.getHostVulnerabilityInventoryById(HOST_ID)).thenReturn(inventory);
    }

    private static HostSoftwareTitle title(Long id, String name, String source, String version, String... cves) {
        HostSoftwareInstalledVersion installed = new HostSoftwareInstalledVersion();
        installed.setVersion(version);
        installed.setVulnerabilities(List.of(cves));
        HostSoftwareTitle title = new HostSoftwareTitle();
        title.setId(id);
        title.setName(name);
        title.setSource(source);
        title.setInstalledVersions(List.of(installed));
        return title;
    }

    private static FleetSoftware hostSoftware(String name, String version, FleetVulnerability... vulnerabilities) {
        FleetSoftware software = new FleetSoftware();
        software.setName(name);
        software.setVersion(version);
        software.setVulnerabilities(List.of(vulnerabilities));
        return software;
    }

    private static FleetVulnerability vulnerability(String cve, Double cvssScore, String resolvedInVersion) {
        FleetVulnerability vulnerability = new FleetVulnerability();
        vulnerability.setCve(cve);
        vulnerability.setCvssScore(cvssScore);
        vulnerability.setResolvedInVersion(resolvedInVersion);
        return vulnerability;
    }
}
