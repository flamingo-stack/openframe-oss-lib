package com.openframe.api.service.rmm.software;

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
import com.openframe.api.service.rmm.fleet.FleetDeviceCountEnricher;
import com.openframe.api.service.rmm.fleet.FleetHostMachineResolver;
import com.openframe.data.document.device.Machine;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostSearchRequest;
import com.openframe.sdk.fleetmdm.model.SoftwareTitleRequest;
import com.openframe.sdk.fleetmdm.model.SoftwareTitle;
import com.openframe.sdk.fleetmdm.model.SoftwareTitleVersion;
import com.openframe.sdk.fleetmdm.model.SoftwareTitlesResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareInventoryServiceTest {

    @Mock private FleetMdmClient fleet;
    @Mock private FleetDeviceCountEnricher deviceCountEnricher;
    @Mock private FleetHostMachineResolver hostMachineResolver;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private com.openframe.data.repository.tool.IntegratedToolRepository integratedToolRepository;

    private SoftwareInventoryService service;

    @BeforeEach
    void setUp() {
        service = new SoftwareInventoryService(integratedToolRepository, deviceCountEnricher, hostMachineResolver, tenantIdProvider);
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
    @DisplayName("getSoftwareFilters: no titles -> valid empty facet lists (never null)")
    void getSoftwareFilters_noTitles_emptyFacets() {
        SoftwareTitlesResponse response = mock(SoftwareTitlesResponse.class);
        when(response.getSoftwareTitles()).thenReturn(List.of());
        when(fleet.listSoftwareTitles(any(SoftwareTitleRequest.class))).thenReturn(response);

        SoftwareFilters filters = service.getSoftwareFilters(null);

        assertThat(filters.getSources()).isEmpty();
        assertThat(filters.getVersionStatuses()).isEmpty();
        assertThat(filters.getSeverities()).isEmpty();
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
        org.mockito.Mockito.verify(deviceCountEnricher, org.mockito.Mockito.never())
                .enrich(anyList(), any(), any());
    }

    // Simulate the enricher's side-effect: write count back via the passed countSetter.
    // Its correlation math is tested in FleetDeviceCountEnricherTest, not here.
    @SuppressWarnings("unchecked")
    private void simulateEnricherSetsCount(int count) {
        org.mockito.Mockito.doAnswer(inv -> {
            List<SoftwareResponse> rows = inv.getArgument(0);
            java.util.function.BiConsumer<SoftwareResponse, Integer> setter = inv.getArgument(2);
            rows.forEach(row -> setter.accept(row, count));
            return null;
        }).when(deviceCountEnricher).enrich(anyList(), any(), any());
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
                versionWithCve("10.0", "CVE-2026-59890"),
                versionWithCve("9.0", "CVE-2026-59890"),
                versionWithCve("58.0.4", "CVE-2026-59890")));
        when(fleet.getSoftwareTitle(42L)).thenReturn(title);
        when(fleet.getVulnerability(org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(new com.openframe.sdk.fleetmdm.model.Vulnerability());

        PageResult<SoftwareVulnerabilityResponse> result =
                service.listVulnerabilitiesForSoftware("42", null, 0, 50, null, true);

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
                service.listVulnerabilitiesForSoftware("42", null, 0, 50, null, true);

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
