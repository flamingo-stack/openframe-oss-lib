package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareCveSeverity;
import com.openframe.api.dto.rmm.software.SoftwareFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareFilterOption;
import com.openframe.api.dto.rmm.software.SoftwareFilters;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceFilters;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceResponse;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceStatus;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareSource;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilityResponse;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.core.exception.BadRequestException;
import com.openframe.api.service.rmm.fleet.DeviceHostInventoryLoader;
import com.openframe.api.service.rmm.fleet.FleetHostMachineResolver;
import com.openframe.api.service.rmm.fleet.HostInventory;
import com.openframe.data.document.device.Machine;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.model.FleetSoftware;
import com.openframe.sdk.fleetmdm.model.FleetVulnerability;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostSearchRequest;
import com.openframe.sdk.fleetmdm.model.HostSoftwareTitle;
import com.openframe.sdk.fleetmdm.model.SoftwareTitleRequest;
import com.openframe.sdk.fleetmdm.model.SoftwareTitle;
import com.openframe.sdk.fleetmdm.model.SoftwareTitleVersion;
import com.openframe.sdk.fleetmdm.model.SoftwareTitlesResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static com.openframe.api.service.rmm.fleet.HostInventoryFixtures.hostSoftware;
import static com.openframe.api.service.rmm.fleet.HostInventoryFixtures.title;
import static com.openframe.api.service.rmm.fleet.HostInventoryFixtures.vulnerability;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
class SoftwareInventoryServiceTest {

    private static final String MACHINE_ID = "machine-1";
    private static final int FIRST_PAGE = 0;
    private static final int PAGE_SIZE = 50;
    private static final String CVE_CRITICAL = "CVE-2024-0001";
    private static final String CVE_MEDIUM = "CVE-2024-0002";

    @Mock private FleetMdmClient fleet;
    @Mock private FleetHostMachineResolver hostMachineResolver;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private com.openframe.data.repository.tool.IntegratedToolRepository integratedToolRepository;
    @Mock private DeviceHostInventoryLoader deviceHostInventoryLoader;

    private SoftwareInventoryService service;

    @BeforeEach
    void setUp() {
        service = new SoftwareInventoryService(integratedToolRepository, hostMachineResolver,
                tenantIdProvider, deviceHostInventoryLoader);
        // Bypass @PostConstruct wireFleetClient — inject the mocked FleetMdmClient directly.
        ReflectionTestUtils.setField(service, "fleet", fleet);
    }

    @Test
    @DisplayName("listDevicesForSoftware: a non-numeric id short-circuits to empty without touching Fleet")
    void listDevices_nonNumericId_emptyNoFleet() {
        assertThat(service.listDevicesForSoftware("not-a-number", null, null, 0, 50).items()).isEmpty();
        verifyNoInteractions(fleet, hostMachineResolver);
    }

    @Test
    @DisplayName("listDevicesForSoftware: fans out per version, tags each host with its version, correlates to a Machine, and drops hosts not enrolled in OpenFrame")
    void listDevices_correlatesAndDropsUnenrolled() {
        SoftwareTitle title = new SoftwareTitle();
        title.setName("Google Chrome");
        SoftwareTitleVersion version = new SoftwareTitleVersion();
        version.setId(10L);
        version.setVersion("1.2.3");
        title.setVersions(List.of(version));

        Host enrolled = host(1L, "u1", "host-1");
        Host foreign = host(2L, "u2", "host-2");   // no matching Machine -> dropped

        when(fleet.getSoftwareTitle(42L)).thenReturn(title);
        when(fleet.searchHosts(any(HostSearchRequest.class))).thenReturn(List.of(enrolled, foreign));
        when(tenantIdProvider.getTenantId()).thenReturn("t1");
        Machine machine = new Machine();
        machine.setMachineId("m-1");
        machine.setHostname("host-1");
        when(hostMachineResolver.resolve(eq("t1"), anyList())).thenReturn(Map.of(1L, machine));

        PageResult<SoftwareOnDeviceResponse> result = service.listDevicesForSoftware("42", null, null, 0, 50);

        assertThat(result.items()).hasSize(1);
        SoftwareOnDeviceResponse row = result.items().get(0);
        assertThat(row.getDevice().getMachineId()).isEqualTo("m-1");
        assertThat(row.getSoftwareVersion()).isEqualTo("1.2.3");
        assertThat(row.getStatus()).isNotNull();
    }

    @Test
    @DisplayName("getSoftwareFilters: empty facet lists (never null) without downloading the Fleet catalog")
    void getSoftwareFilters_emptyFacetsWithoutFleet() {
        SoftwareFilters filters = service.getSoftwareFilters();

        assertThat(filters.getSources()).isEmpty();
        assertThat(filters.getVersionStatuses()).isEmpty();
        assertThat(filters.getSeverities()).isEmpty();
        verifyNoInteractions(fleet);
    }

    @Test
    @DisplayName("listSoftware: one Fleet page per request — paging, search, vulnerable and the devices sort go to Fleet; its count and has-next come back")
    void listSoftware_onePageFromFleet() {
        SoftwareTitle chrome = titleWithSource("Chrome", "homebrew_packages");
        chrome.setId(42L);
        chrome.setHostsCount(31);
        SoftwareTitlesResponse response = titlesPage(45, true, chrome);
        ArgumentCaptor<SoftwareTitleRequest> request = ArgumentCaptor.forClass(SoftwareTitleRequest.class);
        when(fleet.listSoftwareTitles(request.capture())).thenReturn(response);

        PageResult<SoftwareResponse> result = service.listSoftware("chr", 2, 20,
                sort("devicesCount", SortDirection.DESC), true);

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
        assertThat(result.page()).isEqualTo(2);
    }

    @Test
    @DisplayName("listSoftware: sorts Fleet cannot do (CVE count) leave the order to Fleet's default")
    void listSoftware_cveCountSort_fleetDefaultOrder() {
        ArgumentCaptor<SoftwareTitleRequest> request = ArgumentCaptor.forClass(SoftwareTitleRequest.class);
        when(fleet.listSoftwareTitles(request.capture())).thenReturn(titlesPage(0, false));

        service.listSoftware(null, 0, 20, sort("cveCount", SortDirection.DESC), null);

        assertThat(request.getValue().getOrderKey()).isNull();
        assertThat(request.getValue().getOrderDirection()).isNull();
    }

    @Test
    @DisplayName("findById: the devices count is Fleet's own count for the title")
    void findById_devicesCountFromFleet() {
        SoftwareTitle chrome = titleWithSource("Chrome", "homebrew_packages");
        chrome.setId(42L);
        chrome.setHostsCount(7);
        when(fleet.getSoftwareTitle(42L)).thenReturn(chrome);

        assertThat(service.findById("42")).map(SoftwareResponse::getDevicesCount).contains(7);
    }

    @Test
    @DisplayName("listSoftware: an unknown sort field is a client error (BadRequest), not a Fleet call")
    void listSoftware_unknownSortField_throwsBadRequest() {
        BadRequestException ex = org.junit.jupiter.api.Assertions.assertThrows(BadRequestException.class,
                () -> service.listSoftware("", 0, 20, sort("bogus", SortDirection.ASC), null));

        assertThat(ex.getMessage()).contains("bogus").contains("cveCount");
        org.mockito.Mockito.verifyNoInteractions(fleet);
    }

    private static SortInput sort(String field, SortDirection direction) {
        SortInput s = new SortInput();
        s.setField(field);
        s.setDirection(direction);
        return s;
    }

    @Test
    @DisplayName("listDevicesForSoftware: the status filter keeps only devices whose status is selected")
    void listDevices_statusFilter() {
        SoftwareTitle title = new SoftwareTitle();
        title.setName("Google Chrome");
        SoftwareTitleVersion version = new SoftwareTitleVersion();
        version.setId(10L);
        version.setVersion("1.2.3");
        title.setVersions(List.of(version));
        when(fleet.getSoftwareTitle(42L)).thenReturn(title);
        when(fleet.searchHosts(any(HostSearchRequest.class))).thenReturn(List.of(host(1L, "u1", "host-1")));
        when(tenantIdProvider.getTenantId()).thenReturn("t1");
        Machine machine = new Machine();
        machine.setMachineId("m-1");
        machine.setHostname("host-1");
        when(hostMachineResolver.resolve(eq("t1"), anyList())).thenReturn(Map.of(1L, machine));

        // The device is UP_TO_DATE or OUTDATED; a lifecycle status it cannot have filters it out.
        SoftwareOnDeviceFilterInput drop = new SoftwareOnDeviceFilterInput();
        drop.setStatuses(List.of(SoftwareOnDeviceStatus.SCHEDULED_UNINSTALL));
        assertThat(service.listDevicesForSoftware("42", drop, null, 0, 50).items()).isEmpty();

        // Selecting both possible static statuses keeps it.
        SoftwareOnDeviceFilterInput keep = new SoftwareOnDeviceFilterInput();
        keep.setStatuses(List.of(SoftwareOnDeviceStatus.UP_TO_DATE, SoftwareOnDeviceStatus.OUTDATED));
        assertThat(service.listDevicesForSoftware("42", keep, null, 0, 50).items()).hasSize(1);
    }

    @Test
    @DisplayName("softwareDeviceFilters: facets the devices-on-software list by status")
    void softwareDeviceFilters_facetsByStatus() {
        SoftwareTitle title = new SoftwareTitle();
        title.setName("Google Chrome");
        SoftwareTitleVersion version = new SoftwareTitleVersion();
        version.setId(10L);
        version.setVersion("1.2.3");
        title.setVersions(List.of(version));
        when(fleet.getSoftwareTitle(42L)).thenReturn(title);
        when(fleet.searchHosts(any(HostSearchRequest.class))).thenReturn(List.of(host(1L, "u1", "host-1")));
        when(tenantIdProvider.getTenantId()).thenReturn("t1");
        Machine machine = new Machine();
        machine.setMachineId("m-1");
        machine.setHostname("host-1");
        when(hostMachineResolver.resolve(eq("t1"), anyList())).thenReturn(Map.of(1L, machine));

        SoftwareOnDeviceFilters filters = service.getSoftwareDeviceFilters("42", null);

        assertThat(filters.getStatuses()).isNotEmpty();
        int total = filters.getStatuses().stream().mapToInt(SoftwareFilterOption::getCount).sum();
        assertThat(total).isEqualTo(1); // one correlated device → one status bucket, count 1
    }

    private static SoftwareTitle titleWithSource(String name, String fleetSource) {
        SoftwareTitle t = new SoftwareTitle();
        t.setName(name);
        t.setSource(fleetSource);
        SoftwareTitleVersion v = new SoftwareTitleVersion();
        v.setVersion("1.0");
        t.setVersions(List.of(v));
        return t;
    }

    @Test
    @DisplayName("listVulnerabilitiesForSoftware: one CVE affecting many versions is a single row, versions aggregated")
    void listVulnerabilitiesForSoftware_dedupsByCve() {
        SoftwareTitle title = new SoftwareTitle();
        title.setId(42L);
        title.setName("setuptools");
        title.setVersions(List.of(
                versionWithCve(1L, "10.0", "CVE-2026-59890"),
                versionWithCve(2L, "9.0", "CVE-2026-59890"),
                versionWithCve(3L, "58.0.4", "CVE-2026-59890")));
        when(fleet.getSoftwareTitle(42L)).thenReturn(title);
        when(fleet.getSoftwareVersion(anyLong())).thenReturn(versionDetails(cveFound("CVE-2026-59890", null)));

        PageResult<SoftwareVulnerabilityResponse> result =
                service.listVulnerabilitiesForSoftware("42", null, 0, 50, null, true);

        assertThat(result.items()).hasSize(1);
        SoftwareVulnerabilityResponse row = result.items().get(0);
        assertThat(row.getCveId()).isEqualTo("CVE-2026-59890");
        // one row, versions aggregated in numeric (not lexicographic) order
        assertThat(row.getAffectedVersion()).isEqualTo("9.0, 10.0, 58.0.4");
    }

    @Test
    @DisplayName("listVulnerabilitiesForSoftware: CVE details come from one Fleet call per version, never one per CVE; the earliest discovery wins")
    void listVulnerabilitiesForSoftware_detailsPerVersion() {
        SoftwareTitle title = new SoftwareTitle();
        title.setId(42L);
        title.setVersions(List.of(versionWithCve(1L, "1.0", "CVE-A"), versionWithCve(2L, "2.0", "CVE-A")));
        when(fleet.getSoftwareTitle(42L)).thenReturn(title);
        when(fleet.getSoftwareVersion(1L)).thenReturn(versionDetails(cveFound("CVE-A", "2026-09-02T00:00:00Z")));
        when(fleet.getSoftwareVersion(2L)).thenReturn(versionDetails(cveFound("CVE-A", "2026-09-01T00:00:00Z")));

        PageResult<SoftwareVulnerabilityResponse> result =
                service.listVulnerabilitiesForSoftware("42", null, 0, 50, null, true);

        assertThat(result.items()).extracting(row -> row.getDiscoveredAt().toString())
                .containsExactly("2026-09-01T00:00:00Z");
        verify(fleet, never()).getVulnerability(anyString());
    }

    @Test
    @DisplayName("listVulnerabilitiesForSoftware: a version Fleet no longer has (404) does not NPE")
    void listVulnerabilitiesForSoftware_versionGone_noNpe() {
        SoftwareTitle title = new SoftwareTitle();
        title.setId(42L);
        title.setName("setuptools");
        title.setVersions(List.of(versionWithCve(1L, "58.0.4", "CVE-2026-00000")));
        when(fleet.getSoftwareTitle(42L)).thenReturn(title);
        when(fleet.getSoftwareVersion(1L)).thenReturn(null);

        PageResult<SoftwareVulnerabilityResponse> result =
                service.listVulnerabilitiesForSoftware("42", null, 0, 50, null, true);

        assertThat(result.items()).hasSize(1);
        assertThat(result.items().get(0).getCveId()).isEqualTo("CVE-2026-00000");
        assertThat(result.items().get(0).getDiscoveredAt()).isNull();
    }

    private static SoftwareTitleVersion versionWithCve(Long id, String version, String cve) {
        SoftwareTitleVersion v = versionWithCve(version, cve);
        v.setId(id);
        return v;
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

    private static SoftwareTitleVersion versionWithCve(String version, String cve) {
        SoftwareTitleVersion v = new SoftwareTitleVersion();
        v.setVersion(version);
        v.setVulnerabilities(List.of(cve));
        return v;
    }

    @Test
    void listSoftwareForDevice_titleWithCves_rowCarriesInstalledVersionAndHostScopedSummary() {
        // setup
        stubInventory(
                List.of(title(11L, "node", "homebrew_packages", "20.1", CVE_CRITICAL, CVE_MEDIUM)),
                List.of(hostSoftware("node", "20.1",
                        vulnerability(CVE_CRITICAL, 9.8, null), vulnerability(CVE_MEDIUM, 5.0, null))));

        // execution
        PageResult<SoftwareResponse> result =
                service.listSoftwareForDevice(MACHINE_ID, null, null, FIRST_PAGE, PAGE_SIZE, null);

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
    void listSoftwareForDevice_titleWithoutCves_summaryIsNull() {
        // setup
        stubInventory(List.of(title(11L, "node", "homebrew_packages", "20.1")), List.of());

        // execution
        PageResult<SoftwareResponse> result =
                service.listSoftwareForDevice(MACHINE_ID, null, null, FIRST_PAGE, PAGE_SIZE, null);

        // verifications
        assertThat(result.items()).extracting(SoftwareResponse::getVulnerabilitySummary).containsOnlyNulls();
    }

    @Test
    void listSoftwareForDevice_sourcesFilter_keepsMatchingTitlesOnly() {
        // setup
        stubInventory(
                List.of(title(10L, "Google Chrome", "apps", "120.0"), title(11L, "node", "homebrew_packages", "20.1")),
                List.of());
        SoftwareFilterInput filter = new SoftwareFilterInput();
        filter.setSources(List.of(SoftwareSource.BREW));

        // execution
        PageResult<SoftwareResponse> result =
                service.listSoftwareForDevice(MACHINE_ID, filter, null, FIRST_PAGE, PAGE_SIZE, null);

        // verifications
        assertThat(result.items()).extracting(SoftwareResponse::getName).containsExactly("node");
    }

    @Test
    void listSoftwareForDevice_minSeverityHigh_titlesBelowBandExcluded() {
        // setup
        stubInventory(
                List.of(title(10L, "Google Chrome", "apps", "120.0", CVE_CRITICAL),
                        title(11L, "node", "homebrew_packages", "20.1", CVE_MEDIUM)),
                List.of(hostSoftware("Google Chrome", "120.0", vulnerability(CVE_CRITICAL, 9.8, null)),
                        hostSoftware("node", "20.1", vulnerability(CVE_MEDIUM, 5.0, null))));
        SoftwareFilterInput filter = new SoftwareFilterInput();
        filter.setMinSeverity(SoftwareCveSeverity.HIGH);

        // execution
        PageResult<SoftwareResponse> result =
                service.listSoftwareForDevice(MACHINE_ID, filter, null, FIRST_PAGE, PAGE_SIZE, null);

        // verifications
        assertThat(result.items()).extracting(SoftwareResponse::getName).containsExactly("Google Chrome");
    }

    @Test
    void listSoftwareForDevice_defaultOrder_byNameCaseInsensitive() {
        // setup
        stubInventory(
                List.of(title(12L, "zsh", "homebrew_packages", "5.9"),
                        title(10L, "Google Chrome", "apps", "120.0"),
                        title(11L, "node", "homebrew_packages", "20.1")),
                List.of());

        // execution
        PageResult<SoftwareResponse> result =
                service.listSoftwareForDevice(MACHINE_ID, null, null, FIRST_PAGE, PAGE_SIZE, null);

        // verifications
        assertThat(result.items())
                .extracting(SoftwareResponse::getName)
                .containsExactly("Google Chrome", "node", "zsh");
    }

    @Test
    void listSoftwareForDevice_pageRequested_devicesCountReadForPageRowsOnly() {
        // setup
        stubInventory(
                List.of(title(10L, "Google Chrome", "apps", "120.0"),
                        title(11L, "node", "homebrew_packages", "20.1"),
                        title(12L, "zsh", "homebrew_packages", "5.9")),
                List.of());
        when(fleet.getSoftwareTitle(10L)).thenReturn(titleWithHosts(10L, 4));
        when(fleet.getSoftwareTitle(11L)).thenReturn(titleWithHosts(11L, 9));

        // execution
        PageResult<SoftwareResponse> result = service.listSoftwareForDevice(MACHINE_ID, null, null, FIRST_PAGE, 2, null);

        // verifications
        assertThat(result.hasNext()).isTrue();
        assertThat(result.filteredCount()).isEqualTo(3);
        assertThat(result.items())
                .extracting(SoftwareResponse::getName, SoftwareResponse::getDevicesCount)
                .containsExactly(tuple("Google Chrome", 4), tuple("node", 9));
        verify(fleet, never()).getSoftwareTitle(12L);
        verify(fleet, never()).listSoftwareTitles(any(SoftwareTitleRequest.class));
    }

    @Test
    void listSoftwareForDevice_emptyInventory_emptyPageWithoutCatalogOrCountLookups() {
        // setup
        when(deviceHostInventoryLoader.load(fleet, MACHINE_ID)).thenReturn(HostInventory.empty());

        // execution
        PageResult<SoftwareResponse> result =
                service.listSoftwareForDevice(MACHINE_ID, null, null, FIRST_PAGE, PAGE_SIZE, null);

        // verifications
        assertThat(result.items()).isEmpty();
        assertThat(result.filteredCount()).isZero();
        verify(fleet, never()).listSoftwareTitles(any(SoftwareTitleRequest.class));
        verify(fleet, never()).getSoftwareTitle(anyLong());
    }

    @Test
    void listSoftwareForDevice_unknownSortField_throwsBadRequestBeforeLoadingInventory() {
        // setup
        SortInput sort = SortInput.builder().field("publisher").build();

        // execution
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.listSoftwareForDevice(MACHINE_ID, null, null, FIRST_PAGE, PAGE_SIZE, sort));

        // verifications
        assertThat(ex.getMessage()).contains("publisher").contains("Sortable fields");
        verify(deviceHostInventoryLoader, never()).load(fleet, MACHINE_ID);
    }

    @Test
    void getDeviceSoftwareFilters_titlesWithMixedSourcesAndSeverities_countedPerValueWithoutCountLookups() {
        // setup
        when(deviceHostInventoryLoader.load(fleet, MACHINE_ID)).thenReturn(HostInventory.of(
                List.of(title(10L, "Google Chrome", "apps", "120.0", CVE_CRITICAL),
                        title(11L, "node", "homebrew_packages", "20.1", CVE_MEDIUM),
                        title(12L, "zsh", "homebrew_packages", "5.9")),
                List.of(hostSoftware("Google Chrome", "120.0", vulnerability(CVE_CRITICAL, 9.8, null)),
                        hostSoftware("node", "20.1", vulnerability(CVE_MEDIUM, 5.0, null)))));

        // execution
        SoftwareFilters filters = service.getDeviceSoftwareFilters(MACHINE_ID, null);

        // verifications
        assertThat(filters.getSources())
                .extracting(SoftwareFilterOption::getValue, SoftwareFilterOption::getCount)
                .containsExactly(tuple("BREW", 2), tuple("UNMANAGED", 1));
        assertThat(filters.getSeverities())
                .extracting(SoftwareFilterOption::getValue, SoftwareFilterOption::getCount)
                .containsExactly(tuple("CRITICAL", 1), tuple("MEDIUM", 1));
        assertThat(filters.getVersionStatuses()).isEmpty();
        verify(fleet, never()).listSoftwareTitles(any(SoftwareTitleRequest.class));
        verify(fleet, never()).getSoftwareTitle(anyLong());
    }

    @Test
    void getDeviceSoftwareFilters_searchApplied_onlyMatchingTitlesCounted() {
        // setup
        when(deviceHostInventoryLoader.load(fleet, MACHINE_ID)).thenReturn(HostInventory.of(
                List.of(title(10L, "Google Chrome", "apps", "120.0"), title(11L, "node", "homebrew_packages", "20.1")),
                List.of()));

        // execution
        SoftwareFilters filters = service.getDeviceSoftwareFilters(MACHINE_ID, "chrome");

        // verifications
        assertThat(filters.getSources())
                .extracting(SoftwareFilterOption::getValue, SoftwareFilterOption::getCount)
                .containsExactly(tuple("UNMANAGED", 1));
    }

    @Test
    void getDeviceSoftwareFilters_emptyInventory_emptyFacets() {
        // setup
        when(deviceHostInventoryLoader.load(fleet, MACHINE_ID)).thenReturn(HostInventory.empty());

        // execution
        SoftwareFilters filters = service.getDeviceSoftwareFilters(MACHINE_ID, null);

        // verifications
        assertThat(filters.getSources()).isEmpty();
        assertThat(filters.getSeverities()).isEmpty();
    }

    private void stubInventory(List<HostSoftwareTitle> titles, List<FleetSoftware> hostSoftware) {
        when(deviceHostInventoryLoader.load(fleet, MACHINE_ID)).thenReturn(HostInventory.of(titles, hostSoftware));
    }

    private static SoftwareTitle titleWithHosts(long id, int hostsCount) {
        SoftwareTitle title = new SoftwareTitle();
        title.setId(id);
        title.setHostsCount(hostsCount);
        return title;
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

    private static Host host(long id, String uuid, String hostname) {
        Host h = new Host();
        h.setId(id);
        h.setUuid(uuid);
        h.setHostname(hostname);
        return h;
    }
}
