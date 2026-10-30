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
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilityFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilityResponse;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.core.exception.BadRequestException;
import com.openframe.api.service.rmm.fleet.DeviceHostInventoryLoader;
import com.openframe.api.service.rmm.fleet.FleetDeviceCountEnricher;
import com.openframe.api.service.rmm.fleet.FleetHostMachineResolver;
import com.openframe.api.service.rmm.fleet.HostInventory;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.model.FleetSoftware;
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
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Stream;

import static com.openframe.api.service.rmm.fleet.HostInventoryFixtures.hostSoftware;
import static com.openframe.api.service.rmm.fleet.HostInventoryFixtures.title;
import static com.openframe.api.service.rmm.fleet.HostInventoryFixtures.vulnerability;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
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
    @Mock private FleetDeviceCountEnricher deviceCountEnricher;
    @Mock private FleetHostMachineResolver hostMachineResolver;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private com.openframe.data.repository.tool.IntegratedToolRepository integratedToolRepository;
    @Mock private DeviceHostInventoryLoader deviceHostInventoryLoader;
    @Mock private SoftwareAutoUpdateService autoUpdateService;
    @Mock private TagAssignmentRepository tagAssignmentRepository;
    @Mock private OrganizationRepository organizationRepository;

    @Captor private ArgumentCaptor<List<SoftwareResponse>> pageRowsCaptor;
    @Captor private ArgumentCaptor<Function<FleetSoftware, Stream<String>>> keysOfCaptor;

    private SoftwareInventoryService service;

    @BeforeEach
    void setUp() {
        service = new SoftwareInventoryService(integratedToolRepository, deviceCountEnricher, hostMachineResolver,
                tenantIdProvider, deviceHostInventoryLoader, autoUpdateService, tagAssignmentRepository, organizationRepository);
        // Bypass @PostConstruct wireFleetClient — inject the mocked FleetMdmClient directly.
        ReflectionTestUtils.setField(service, "fleet", fleet);
    }

    @Test
    @DisplayName("listDevicesForSoftware: a non-numeric id short-circuits to empty without touching Fleet")
    void listDevices_nonNumericId_emptyNoFleet() {
        assertThat(service.listDevicesForSoftware("not-a-number", null, null, 0, 50, null).items()).isEmpty();
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

        PageResult<SoftwareOnDeviceResponse> result = service.listDevicesForSoftware("42", null, null, 0, 50, null);

        assertThat(result.items()).hasSize(1);
        SoftwareOnDeviceResponse row = result.items().get(0);
        assertThat(row.getDevice().getMachineId()).isEqualTo("m-1");
        assertThat(row.getSoftwareVersion()).isEqualTo("1.2.3");
        assertThat(row.getStatus()).isNotNull();
    }

    @Test
    @DisplayName("getSoftwareFilters: no titles -> valid empty facet lists (never null)")
    void getSoftwareFilters_noTitles_emptyFacets() {
        SoftwareTitlesResponse response = mock(SoftwareTitlesResponse.class);
        when(response.getSoftwareTitles()).thenReturn(List.of());
        when(fleet.listSoftwareTitles(any(SoftwareTitleRequest.class))).thenReturn(response);

        SoftwareFilters filters = service.getSoftwareFilters(null);

        assertThat(filters.getSources()).isEmpty();
        assertThat(filters.getVersionStatuses()).isEmpty();
        assertThat(filters.getSeverities()).isEmpty();
        assertThat(filters.getAutoUpdateStatuses()).isEmpty();
    }

    @Test
    @DisplayName("listSoftware: sort by cveCount DESC is a client-side sort — highest CVE count first, ties by name")
    void listSoftware_sortByCveCount_desc_clientSideTiesByName() {
        SoftwareTitlesResponse response = org.mockito.Mockito.mock(SoftwareTitlesResponse.class);
        when(response.getSoftwareTitles()).thenReturn(List.of(
                titleWithCves("Bravo", 5),
                titleWithCves("Alpha", 5),
                titleWithCves("Chrome", 40)));
        when(fleet.listSoftwareTitles(any(SoftwareTitleRequest.class))).thenReturn(response); // meta null -> single page in the scan
        simulateEnricherSetsCount(1);

        PageResult<SoftwareResponse> result = service.listSoftware("", 0, 20, sort("cveCount", SortDirection.DESC), null);

        assertThat(result.items()).extracting(SoftwareResponse::getName)
                .containsExactly("Chrome", "Alpha", "Bravo"); // 40 first; the two 5s by name ascending
    }

    @Test
    @DisplayName("getSoftwareFilters: with titles → source facet counts each package-manager bucket; unknown fleet source falls back to UNMANAGED")
    void getSoftwareFilters_countsSourceBucketsAcrossTitles() {
        SoftwareTitlesResponse response = mock(SoftwareTitlesResponse.class);
        when(response.getSoftwareTitles()).thenReturn(List.of(
                titleWithSource("Chocolatey app 1", "chocolatey_packages"),
                titleWithSource("Chocolatey app 2", "chocolatey_packages"),
                titleWithSource("Homebrew tool",    "homebrew_packages"),
                titleWithSource("Random pkg",       "programs")));      // unknown -> UNMANAGED
        when(fleet.listSoftwareTitles(any(SoftwareTitleRequest.class))).thenReturn(response);

        SoftwareFilters filters = service.getSoftwareFilters(null);

        // Each dimension is capped by SoftwareFilterOption; order follows enum ordinal so we assert as-map.
        java.util.Map<String, Integer> sourceCounts = filters.getSources().stream()
                .collect(java.util.stream.Collectors.toMap(SoftwareFilterOption::getValue, SoftwareFilterOption::getCount));
        assertThat(sourceCounts).containsEntry(SoftwareSource.CHOCOLATEY.name(), 2);
        assertThat(sourceCounts).containsEntry(SoftwareSource.BREW.name(), 1);
        assertThat(sourceCounts).containsEntry(SoftwareSource.UNMANAGED.name(), 1);
    }

    @Test
    @DisplayName("listSoftware: delegates devicesCount enrichment to FleetDeviceCountEnricher — whatever count the enricher sets is what the user sees, and Fleet's raw hosts_count is discarded in the process")
    void listSoftware_delegatesEnrichmentToEnricher() {
        // Fleet says 31 devices; enricher correlates down to 2 real Machines.
        SoftwareTitle raw = new SoftwareTitle();
        raw.setId(42L);
        raw.setName("Chrome");
        raw.setHostsCount(31);
        raw.setVersions(List.of());
        SoftwareTitlesResponse response = mock(SoftwareTitlesResponse.class);
        when(response.getSoftwareTitles()).thenReturn(List.of(raw));
        when(fleet.listSoftwareTitles(any(SoftwareTitleRequest.class))).thenReturn(response);
        simulateEnricherSetsCount(2);

        PageResult<SoftwareResponse> result = service.listSoftware("", 0, 20, null, null);

        assertThat(result.items()).hasSize(1);
        // The critical invariant: user sees the enricher-provided count, not Fleet's raw 31.
        assertThat(result.items().get(0).getDevicesCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("getSoftwareFilters: bypasses devicesCount enrichment — facet counts don't need it, and firing N Fleet /hosts calls per facet request is wasteful")
    void getSoftwareFilters_doesNotFireEnrichment() {
        SoftwareTitlesResponse response = mock(SoftwareTitlesResponse.class);
        when(response.getSoftwareTitles()).thenReturn(List.of(
                titleWithSource("Chocolatey app", "chocolatey_packages")));
        when(fleet.listSoftwareTitles(any(SoftwareTitleRequest.class))).thenReturn(response);

        service.getSoftwareFilters(null);

        // Invariant: facet reads must never fire the enricher — that would explode into N Fleet
        // /hosts lookups per facet request.
        org.mockito.Mockito.verifyNoInteractions(deviceCountEnricher);
    }

    // Simulate the enricher's side-effect: write count back via the passed countSetter.
    // Its correlation math is tested in FleetDeviceCountEnricherTest, not here.
    @SuppressWarnings("unchecked")
    private void simulateEnricherSetsCount(int count) {
        org.mockito.Mockito.doAnswer(inv -> {
            List<SoftwareResponse> rows = inv.getArgument(0);
            java.util.function.BiConsumer<SoftwareResponse, Integer> setter = inv.getArgument(4);
            rows.forEach(row -> setter.accept(row, count));
            return null;
        }).when(deviceCountEnricher).enrichFromHostSoftware(anyList(), any(), any(), any(), any());
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
    @DisplayName("listDevicesForSoftware: a machine with several versions or several Fleet hosts is one row listing its versions")
    void listDevices_oneRowPerMachine_versionsJoined() {
        SoftwareTitle title = new SoftwareTitle();
        title.setName("pip");
        SoftwareTitleVersion older = new SoftwareTitleVersion();
        older.setId(10L);
        older.setVersion("21.2.4");
        SoftwareTitleVersion newer = new SoftwareTitleVersion();
        newer.setId(11L);
        newer.setVersion("26.1.2");
        title.setVersions(List.of(newer, older));
        when(fleet.getSoftwareTitle(103L)).thenReturn(title);
        // host 1 and host 2 are the same machine (a duplicate Fleet host); host 3 is another machine
        when(fleet.searchHosts(any(HostSearchRequest.class))).thenAnswer(inv ->
                ((HostSearchRequest) inv.getArgument(0)).getSoftwareVersionId() == 10L
                        ? List.of(host(1L, "u1", "mac"), host(2L, "u1", "mac"))
                        : List.of(host(1L, "u1", "mac"), host(3L, "u3", "pc")));
        when(tenantIdProvider.getTenantId()).thenReturn("t1");
        Machine mac = new Machine();
        mac.setMachineId("m-mac");
        mac.setHostname("mac");
        Machine pc = new Machine();
        pc.setMachineId("m-pc");
        pc.setHostname("pc");
        when(hostMachineResolver.resolve(eq("t1"), anyList())).thenReturn(Map.of(1L, mac, 2L, mac, 3L, pc));

        PageResult<SoftwareOnDeviceResponse> result = service.listDevicesForSoftware("103", null, null, 0, 50, null);

        assertThat(result.items())
                .extracting(row -> row.getDevice().getMachineId(), SoftwareOnDeviceResponse::getSoftwareVersion)
                .containsExactlyInAnyOrder(tuple("m-mac", "21.2.4, 26.1.2"), tuple("m-pc", "26.1.2"));
        assertThat(result.filteredCount()).isEqualTo(2);
        int counted = service.getSoftwareDeviceFilters("103", null).getStatuses().stream()
                .mapToInt(SoftwareFilterOption::getCount).sum();
        assertThat(counted).isEqualTo(2);
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
        assertThat(service.listDevicesForSoftware("42", drop, null, 0, 50, null).items()).isEmpty();

        // Selecting both possible static statuses keeps it.
        SoftwareOnDeviceFilterInput keep = new SoftwareOnDeviceFilterInput();
        keep.setStatuses(List.of(SoftwareOnDeviceStatus.UP_TO_DATE, SoftwareOnDeviceStatus.OUTDATED));
        assertThat(service.listDevicesForSoftware("42", keep, null, 0, 50, null).items()).hasSize(1);
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
        // non-null in the schema: no device has a value for these, so empty, never null
        assertThat(filters.getInstalledBy()).isEmpty();
        assertThat(filters.getAutoUpdateStatuses()).isEmpty();
        assertThat(filters.getOrganizations()).isEmpty();
        assertThat(filters.getDeviceStatuses()).isEmpty();
    }

    @Test
    @DisplayName("listSoftware: titles the enricher correlates to zero live devices are hidden from the list")
    void listSoftware_dropsZeroDeviceTitles() {
        SoftwareTitlesResponse response = mock(SoftwareTitlesResponse.class);
        when(response.getSoftwareTitles()).thenReturn(List.of(
                titleWithSource("Keep", "homebrew_packages"),
                titleWithSource("Drop", "homebrew_packages")));
        when(fleet.listSoftwareTitles(any(SoftwareTitleRequest.class))).thenReturn(response);
        org.mockito.Mockito.doAnswer(inv -> {
            List<SoftwareResponse> rows = inv.getArgument(0);
            java.util.function.BiConsumer<SoftwareResponse, Integer> setter = inv.getArgument(4);
            rows.forEach(row -> setter.accept(row, "Keep".equals(row.getName()) ? 1 : 0));
            return null;
        }).when(deviceCountEnricher).enrichFromHostSoftware(anyList(), any(), any(), any(), any());

        PageResult<SoftwareResponse> result = service.listSoftware("", 0, 20, null, null);

        assertThat(result.items()).extracting(SoftwareResponse::getName).containsExactly("Keep");
    }

    @Test
    @DisplayName("listSoftware: a host's software version is counted under the title that owns that version id")
    @SuppressWarnings("unchecked")
    void listSoftware_keysHostSoftwareByTitleOfItsVersion() {
        SoftwareTitle chrome = titleWithSource("Chrome", "homebrew_packages");
        chrome.setId(42L);
        chrome.getVersions().get(0).setId(7L);
        SoftwareTitlesResponse response = mock(SoftwareTitlesResponse.class);
        when(response.getSoftwareTitles()).thenReturn(List.of(chrome));
        when(fleet.listSoftwareTitles(any(SoftwareTitleRequest.class))).thenReturn(response);
        simulateEnricherSetsCount(1);

        service.listSoftware("", 0, 20, null, null);

        org.mockito.ArgumentCaptor<java.util.function.Function<FleetSoftware, java.util.stream.Stream<String>>> keysOf =
                org.mockito.ArgumentCaptor.forClass(java.util.function.Function.class);
        org.mockito.ArgumentCaptor<java.util.function.Function<SoftwareResponse, String>> rowKey =
                org.mockito.ArgumentCaptor.forClass(java.util.function.Function.class);
        org.mockito.Mockito.verify(deviceCountEnricher)
                .enrichFromHostSoftware(anyList(), any(), keysOf.capture(), rowKey.capture(), any());
        assertThat(keysOf.getValue().apply(installed(7L))).containsExactly("42");
        assertThat(keysOf.getValue().apply(installed(8L))).isEmpty();
        assertThat(rowKey.getValue().apply(SoftwareResponse.builder().id("42").build())).isEqualTo("42");
    }

    private static FleetSoftware installed(long versionId) {
        FleetSoftware software = new FleetSoftware();
        software.setId(versionId);
        return software;
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
                versionWithCve("10.0", "CVE-2026-59890"),
                versionWithCve("9.0", "CVE-2026-59890"),
                versionWithCve("58.0.4", "CVE-2026-59890")));
        when(fleet.getSoftwareTitle(42L)).thenReturn(title);
        when(fleet.getVulnerability(org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(new com.openframe.sdk.fleetmdm.model.Vulnerability());

        PageResult<SoftwareVulnerabilityResponse> result =
                service.listVulnerabilitiesForSoftware("42", null, null, 0, 50, null, true);

        assertThat(result.items()).hasSize(1);
        SoftwareVulnerabilityResponse row = result.items().get(0);
        assertThat(row.getCveId()).isEqualTo("CVE-2026-59890");
        // one row, versions aggregated in numeric (not lexicographic) order
        assertThat(row.getAffectedVersion()).isEqualTo("9.0, 10.0, 58.0.4");
    }

    @Test
    @DisplayName("listVulnerabilitiesForSoftware: a CVE Fleet has no record for (null enrichment) does not NPE")
    void listVulnerabilitiesForSoftware_nullEnrichment_noNpe() {
        SoftwareTitle title = new SoftwareTitle();
        title.setId(42L);
        title.setName("setuptools");
        title.setVersions(List.of(versionWithCve("58.0.4", "CVE-2026-00000")));
        when(fleet.getSoftwareTitle(42L)).thenReturn(title);
        when(fleet.getVulnerability(org.mockito.ArgumentMatchers.anyString())).thenReturn(null); // 404 from Fleet

        PageResult<SoftwareVulnerabilityResponse> result =
                service.listVulnerabilitiesForSoftware("42", null, null, 0, 50, null, true);

        assertThat(result.items()).hasSize(1);
        assertThat(result.items().get(0).getCveId()).isEqualTo("CVE-2026-00000");
        assertThat(result.items().get(0).getSeverity()).isNull(); // no enrichment → no severity
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
    void listSoftwareForDevice_pageRequested_everyFilteredRowCountedFromHostSoftwareNotPerRow() {
        // setup
        stubInventory(
                List.of(title(10L, "Google Chrome", "apps", "120.0"),
                        title(11L, "node", "homebrew_packages", "20.1"),
                        title(12L, "zsh", "homebrew_packages", "5.9")),
                List.of());

        // execution
        PageResult<SoftwareResponse> result = service.listSoftwareForDevice(MACHINE_ID, null, null, FIRST_PAGE, 2, null);

        // verifications
        assertThat(result.hasNext()).isTrue();
        assertThat(result.filteredCount()).isEqualTo(3);
        verify(deviceCountEnricher).enrichFromHostSoftware(pageRowsCaptor.capture(), any(), any(), any(), any());
        assertThat(pageRowsCaptor.getValue())
                .extracting(SoftwareResponse::getName)
                .containsExactly("Google Chrome", "node", "zsh");
        verify(deviceCountEnricher, never()).enrich(anyList(), any(), any());
    }

    @Test
    void listSoftwareForDevice_sortDevicesCountDesc_orderedByFleetWideCount() {
        // setup
        stubInventory(
                List.of(title(10L, "Google Chrome", "apps", "120.0"),
                        title(11L, "node", "homebrew_packages", "20.1"),
                        title(12L, "zsh", "homebrew_packages", "5.9")),
                List.of());
        simulateEnricherSetsCounts(Map.of("Google Chrome", 1, "node", 5, "zsh", 3));
        SortInput sort = SortInput.builder().field("devicesCount").direction(SortDirection.DESC).build();

        // execution
        PageResult<SoftwareResponse> result =
                service.listSoftwareForDevice(MACHINE_ID, null, null, FIRST_PAGE, PAGE_SIZE, sort);

        // verifications
        assertThat(result.items())
                .extracting(SoftwareResponse::getName, SoftwareResponse::getDevicesCount)
                .containsExactly(tuple("node", 5), tuple("zsh", 3), tuple("Google Chrome", 1));
    }

    @Test
    void listSoftwareForDevice_pageRequested_devicesCountKeyedByCatalogTitleOfHostSoftwareVersion() {
        // setup
        when(deviceHostInventoryLoader.load(fleet, MACHINE_ID))
                .thenReturn(HostInventory.of(List.of(title(10L, "Google Chrome", "apps", "120.0")), List.of()));
        SoftwareTitlesResponse catalog = catalog(10L, 7L);
        when(fleet.listSoftwareTitles(any(SoftwareTitleRequest.class))).thenReturn(catalog);
        FleetSoftware chromeVersion = installed(7L);

        // execution
        service.listSoftwareForDevice(MACHINE_ID, null, null, FIRST_PAGE, PAGE_SIZE, null);

        // verifications
        verify(deviceCountEnricher).enrichFromHostSoftware(anyList(), any(), keysOfCaptor.capture(), any(), any());
        assertThat(keysOfCaptor.getValue().apply(chromeVersion)).containsExactly("10");
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
        verifyNoInteractions(deviceCountEnricher);
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
        verifyNoInteractions(deviceCountEnricher);
        verify(fleet, never()).listSoftwareTitles(any(SoftwareTitleRequest.class));
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

    @SuppressWarnings("unchecked")
    private void simulateEnricherSetsCounts(Map<String, Integer> countByName) {
        org.mockito.Mockito.doAnswer(inv -> {
            List<SoftwareResponse> rows = inv.getArgument(0);
            java.util.function.BiConsumer<SoftwareResponse, Integer> setter = inv.getArgument(4);
            rows.forEach(row -> setter.accept(row, countByName.get(row.getName())));
            return null;
        }).when(deviceCountEnricher).enrichFromHostSoftware(anyList(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("softwareDevices status: a device on the highest version seen is UP_TO_DATE, the rest OUTDATED, in numeric order")
    void listDevices_statusAgainstTheHighestVersion() {
        stubDevices("homebrew_packages", device("m-1", "9.0"), device("m-2", "10.0"));

        List<SoftwareOnDeviceResponse> rows = service.listDevicesForSoftware("42", null, null, 0, 50, null).items();

        assertThat(rows).extracting(row -> row.getDevice().getMachineId(), SoftwareOnDeviceResponse::getStatus)
                .containsExactlyInAnyOrder(tuple("m-1", SoftwareOnDeviceStatus.OUTDATED), tuple("m-2", SoftwareOnDeviceStatus.UP_TO_DATE));
    }

    @Test
    @DisplayName("softwareDevices sort: by softwareVersion in numeric order, both directions; an unknown field is a client error before Fleet")
    void listDevices_sortBySoftwareVersion() {
        stubDevices("apps", device("m-1", "9.0"), device("m-2", "10.0"), device("m-3", "1.5"));

        assertThat(service.listDevicesForSoftware("42", null, null, 0, 50, sort("softwareVersion", SortDirection.ASC)).items())
                .extracting(SoftwareOnDeviceResponse::getSoftwareVersion).containsExactly("1.5", "9.0", "10.0");
        assertThat(service.listDevicesForSoftware("42", null, null, 0, 50, sort("softwareVersion", SortDirection.DESC)).items())
                .extracting(SoftwareOnDeviceResponse::getSoftwareVersion).containsExactly("10.0", "9.0", "1.5");
    }

    @Test
    void listDevices_unknownSortField_rejectedBeforeFleet() {
        assertThrows(BadRequestException.class,
                () -> service.listDevicesForSoftware("42", null, null, 0, 50, sort("hostname", SortDirection.ASC)));
        verifyNoInteractions(fleet);
    }

    @Test
    @DisplayName("softwareDevices installedBy: the package manager Fleet names; an app it only calls apps/programs is unknown, not Manually")
    void listDevices_installedBy() {
        stubDevices("homebrew_packages", device("m-1", "1.0"));
        assertThat(service.listDevicesForSoftware("42", null, null, 0, 50, null).items())
                .extracting(SoftwareOnDeviceResponse::getInstalledBy).containsExactly(SoftwareSource.BREW);

        stubDevices("apps", device("m-1", "1.0"));
        assertThat(service.listDevicesForSoftware("42", null, null, 0, 50, null).items().get(0).getInstalledBy()).isNull();
    }

    @Test
    @DisplayName("softwareDevices filters: customer, device status, installedBy, tags and auto-update each narrow the list")
    void listDevices_filters() {
        Machine acme = device("m-1", "1.0");
        acme.setOrganizationId("org-acme");
        acme.setStatus(DeviceStatus.ONLINE);
        Machine globex = device("m-2", "1.0");
        globex.setOrganizationId("org-globex");
        globex.setStatus(DeviceStatus.OFFLINE);
        stubDevices("homebrew_packages", acme, globex);
        autoUpdateOn("m-1");

        SoftwareOnDeviceFilterInput byCustomer = new SoftwareOnDeviceFilterInput();
        byCustomer.setOrganizationIds(List.of("org-globex"));
        assertThat(machineIds(byCustomer)).containsExactly("m-2");

        SoftwareOnDeviceFilterInput byDeviceStatus = new SoftwareOnDeviceFilterInput();
        byDeviceStatus.setDeviceStatuses(List.of(DeviceStatus.ONLINE));
        assertThat(machineIds(byDeviceStatus)).containsExactly("m-1");

        SoftwareOnDeviceFilterInput byAutoUpdate = new SoftwareOnDeviceFilterInput();
        byAutoUpdate.setAutoUpdateStatuses(List.of(SoftwareAutoUpdateStatus.ON));
        assertThat(machineIds(byAutoUpdate)).containsExactly("m-1");

        SoftwareOnDeviceFilterInput byInstalledBy = new SoftwareOnDeviceFilterInput();
        byInstalledBy.setInstalledBy(List.of(SoftwareSource.WINGET));
        assertThat(machineIds(byInstalledBy)).isEmpty();

        SoftwareOnDeviceFilterInput byTag = new SoftwareOnDeviceFilterInput();
        byTag.setDeviceTagIds(List.of("tag-1"));
        when(tagAssignmentRepository.findByEntityIdInAndTagIdInAndEntityType(List.of("m-1", "m-2"), List.of("tag-1"), TagEntityType.DEVICE))
                .thenReturn(List.of(TagAssignment.builder().entityId("m-2").build()));
        assertThat(machineIds(byTag)).containsExactly("m-2");
    }

    @Test
    @DisplayName("softwareDevices: the auto-update filter sees every device, not only the page, and the count follows it")
    void listDevices_autoUpdateFilter_beforeThePage() {
        stubDevices("homebrew_packages", device("m-1", "1.0"), device("m-2", "1.0"), device("m-3", "1.0"));
        autoUpdateOn("m-3");
        SoftwareOnDeviceFilterInput filter = new SoftwareOnDeviceFilterInput();
        filter.setAutoUpdateStatuses(List.of(SoftwareAutoUpdateStatus.ON));

        PageResult<SoftwareOnDeviceResponse> page = service.listDevicesForSoftware("42", filter, null, 0, 1, null);

        assertThat(page.items()).extracting(row -> row.getDevice().getMachineId()).containsExactly("m-3");
        assertThat(page.filteredCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("softwareDeviceFilters: installedBy, auto-update, device status and customer are counted over the devices")
    void softwareDeviceFilters_allFacets() {
        Machine acme = device("m-1", "1.0");
        acme.setOrganizationId("org-acme");
        acme.setStatus(DeviceStatus.ONLINE);
        Machine alsoAcme = device("m-2", "1.0");
        alsoAcme.setOrganizationId("org-acme");
        alsoAcme.setStatus(DeviceStatus.OFFLINE);
        Machine lost = device("m-3", "1.0");
        lost.setOrganizationId("org-gone");
        lost.setStatus(DeviceStatus.ONLINE);
        stubDevices("homebrew_packages", acme, alsoAcme, lost);
        autoUpdateOn("m-1");
        Organization organization = new Organization();
        organization.setOrganizationId("org-acme");
        organization.setName("Acme");
        when(organizationRepository.findByOrganizationIdIn(Set.of("org-acme", "org-gone"))).thenReturn(List.of(organization));

        SoftwareOnDeviceFilters filters = service.getSoftwareDeviceFilters("42", null);

        assertThat(filters.getInstalledBy()).extracting(SoftwareFilterOption::getValue, SoftwareFilterOption::getCount)
                .containsExactly(tuple("BREW", 3));
        assertThat(filters.getAutoUpdateStatuses()).extracting(SoftwareFilterOption::getValue, SoftwareFilterOption::getCount)
                .containsExactly(tuple("ON", 1));
        assertThat(filters.getDeviceStatuses()).extracting(SoftwareFilterOption::getValue, SoftwareFilterOption::getCount)
                .containsExactlyInAnyOrder(tuple("ONLINE", 2), tuple("OFFLINE", 1));
        // a customer without a record still shows, by its id
        assertThat(filters.getOrganizations()).extracting(SoftwareFilterOption::getValue, SoftwareFilterOption::getLabel, SoftwareFilterOption::getCount)
                .containsExactly(tuple("org-acme", "Acme", 2), tuple("org-gone", "org-gone", 1));
    }

    @Test
    void softwareDeviceFilters_noOrganizationOnAnyDevice_noLookup() {
        stubDevices("apps", device("m-1", "1.0"));

        assertThat(service.getSoftwareDeviceFilters("42", null).getOrganizations()).isEmpty();
        verifyNoInteractions(organizationRepository);
    }

    @Test
    @DisplayName("softwareVulnerabilities: the severities filter keeps only those bands; no filter keeps all")
    void listVulnerabilitiesForSoftware_severitiesFilter() {
        SoftwareTitle title = new SoftwareTitle();
        title.setId(42L);
        title.setVersions(List.of(versionWithCve("1.0", "CVE-HIGH"), versionWithCve("1.0", "CVE-LOW")));
        when(fleet.getSoftwareTitle(42L)).thenReturn(title);
        when(fleet.getVulnerability("CVE-HIGH")).thenReturn(cvss(8.5));
        when(fleet.getVulnerability("CVE-LOW")).thenReturn(cvss(2.0));
        SoftwareVulnerabilityFilterInput high = new SoftwareVulnerabilityFilterInput();
        high.setSeverities(List.of(SoftwareCveSeverity.HIGH));

        assertThat(service.listVulnerabilitiesForSoftware("42", high, null, 0, 50, null, true).items())
                .extracting(SoftwareVulnerabilityResponse::getCveId).containsExactly("CVE-HIGH");
        assertThat(service.listVulnerabilitiesForSoftware("42", null, null, 0, 50, null, true).items()).hasSize(2);
    }

    @Test
    @DisplayName("deviceSoftware: the auto-update filter narrows the rows and the count, and the facet counts it")
    void listSoftwareForDevice_autoUpdateFilterAndFacet() {
        stubInventory(List.of(title(10L, "Google Chrome", "apps", "120.0"), title(11L, "node", "homebrew_packages", "20.1")), List.of());
        org.mockito.Mockito.doAnswer(call -> {
            List<SoftwareResponse> rows = call.getArgument(1);
            rows.stream().filter(row -> "node".equals(row.getName())).forEach(row -> row.setAutoUpdate(SoftwareAutoUpdateStatus.ON));
            return null;
        }).when(autoUpdateService).applyToSoftwareOnDevice(eq(MACHINE_ID), anyList());
        SoftwareFilterInput filter = new SoftwareFilterInput();
        filter.setAutoUpdateStatuses(List.of(SoftwareAutoUpdateStatus.ON));

        PageResult<SoftwareResponse> page = service.listSoftwareForDevice(MACHINE_ID, filter, null, 0, 1, null);

        assertThat(page.items()).extracting(SoftwareResponse::getName).containsExactly("node");
        assertThat(page.filteredCount()).isEqualTo(1);
        assertThat(service.getDeviceSoftwareFilters(MACHINE_ID, null).getAutoUpdateStatuses())
                .extracting(SoftwareFilterOption::getValue, SoftwareFilterOption::getCount).containsExactly(tuple("ON", 1));
    }

    private List<String> machineIds(SoftwareOnDeviceFilterInput filter) {
        return service.listDevicesForSoftware("42", filter, null, 0, 50, null).items().stream()
                .map(row -> row.getDevice().getMachineId()).toList();
    }

    private void autoUpdateOn(String machineId) {
        org.mockito.Mockito.doAnswer(call -> {
            List<SoftwareOnDeviceResponse> rows = call.getArgument(1);
            rows.stream().filter(row -> machineId.equals(row.getDevice().getMachineId()))
                    .forEach(row -> row.setAutoUpdate(SoftwareAutoUpdateStatus.ON));
            return null;
        }).when(autoUpdateService).applyToDevices(eq("42"), anyList());
    }

    // one Fleet version per device; the version is carried on the machine's hostname for the stub below
    private void stubDevices(String fleetSource, Machine... machines) {
        SoftwareTitle title = new SoftwareTitle();
        title.setSource(fleetSource);
        List<SoftwareTitleVersion> versions = new java.util.ArrayList<>();
        Map<Long, Host> hostByVersion = new java.util.HashMap<>();
        Map<Long, Machine> machineByHost = new java.util.HashMap<>();
        for (int i = 0; i < machines.length; i++) {
            long id = i + 1L;
            SoftwareTitleVersion version = new SoftwareTitleVersion();
            version.setId(id);
            version.setVersion(machines[i].getHostname());
            versions.add(version);
            hostByVersion.put(id, host(id, "u" + id, machines[i].getHostname()));
            machineByHost.put(id, machines[i]);
        }
        title.setVersions(versions);
        when(fleet.getSoftwareTitle(42L)).thenReturn(title);
        when(fleet.searchHosts(any(HostSearchRequest.class)))
                .thenAnswer(call -> List.of(hostByVersion.get(call.<HostSearchRequest>getArgument(0).getSoftwareVersionId())));
        when(tenantIdProvider.getTenantId()).thenReturn("t1");
        when(hostMachineResolver.resolve(eq("t1"), anyList())).thenReturn(machineByHost);
    }

    private static Machine device(String machineId, String version) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        machine.setHostname(version);
        return machine;
    }

    private static com.openframe.sdk.fleetmdm.model.Vulnerability cvss(double score) {
        com.openframe.sdk.fleetmdm.model.Vulnerability vulnerability = new com.openframe.sdk.fleetmdm.model.Vulnerability();
        vulnerability.setCvssScore(score);
        return vulnerability;
    }

    private void stubInventory(List<HostSoftwareTitle> titles, List<FleetSoftware> hostSoftware) {
        when(deviceHostInventoryLoader.load(fleet, MACHINE_ID)).thenReturn(HostInventory.of(titles, hostSoftware));
        when(fleet.listSoftwareTitles(any(SoftwareTitleRequest.class))).thenReturn(new SoftwareTitlesResponse());
    }

    private static SoftwareTitlesResponse catalog(long titleId, long versionId) {
        SoftwareTitleVersion version = new SoftwareTitleVersion();
        version.setId(versionId);
        SoftwareTitle title = new SoftwareTitle();
        title.setId(titleId);
        title.setVersions(List.of(version));
        SoftwareTitlesResponse response = new SoftwareTitlesResponse();
        response.setSoftwareTitles(List.of(title));
        return response;
    }

    private static SoftwareTitle titleWithCves(String name, int cveCount) {
        SoftwareTitle t = new SoftwareTitle();
        t.setName(name);
        SoftwareTitleVersion v = new SoftwareTitleVersion();
        v.setVersion("1.0");
        v.setVulnerabilities(java.util.stream.IntStream.range(0, cveCount)
                .mapToObj(i -> "CVE-" + name + "-" + i).toList());
        t.setVersions(List.of(v));
        return t;
    }

    private static Host host(long id, String uuid, String hostname) {
        Host h = new Host();
        h.setId(id);
        h.setUuid(uuid);
        h.setHostname(hostname);
        return h;
    }
}
