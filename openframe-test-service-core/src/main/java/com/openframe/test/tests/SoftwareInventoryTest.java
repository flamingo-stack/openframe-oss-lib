package com.openframe.test.tests;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.api.SoftwareInventoryApi;
import com.openframe.test.context.PipelineContext;
import com.openframe.test.data.dto.device.DeviceConnection;
import com.openframe.test.data.dto.device.DeviceEdge;
import com.openframe.test.data.dto.device.DeviceStatus;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.shared.FilterOption;
import com.openframe.test.data.dto.shared.GraphqlError;
import com.openframe.test.data.dto.shared.SortInput;
import com.openframe.test.data.dto.software.AffectedSoftware;
import com.openframe.test.data.dto.software.Software;
import com.openframe.test.data.dto.software.SoftwareConnection;
import com.openframe.test.data.dto.software.SoftwareFilterInput;
import com.openframe.test.data.dto.software.SoftwareFilters;
import com.openframe.test.data.dto.software.SoftwareOnDevice;
import com.openframe.test.data.dto.software.SoftwareOnDeviceConnection;
import com.openframe.test.data.dto.software.SoftwareOnDeviceFilterInput;
import com.openframe.test.data.dto.software.SoftwareOnDeviceFilters;
import com.openframe.test.data.dto.software.SoftwareVulnerability;
import com.openframe.test.data.dto.software.SoftwareVulnerabilityConnection;
import com.openframe.test.data.dto.software.Vulnerability;
import com.openframe.test.data.dto.software.VulnerabilityConnection;
import com.openframe.test.data.dto.software.VulnerabilityFilterInput;
import com.openframe.test.data.dto.software.VulnerabilityFilters;
import com.openframe.test.data.generator.DeviceGenerator;
import com.openframe.test.helpers.ai.RunId;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

// Software inventory and vulnerability reads (CP-27 fleet-wide, CP-28 on vm115982): Fleet MDM data behind api/graphql, read-only, so nothing is created and nothing needs cleaning up.
@Tag("saas")
@Tag("software-inventory")
@DisplayName("Software inventory")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class SoftwareInventoryTest extends BaseTest {

    private static final String WINDOWS = "WINDOWS";
    // The enrolled Windows box on qa; the tenant also holds PENDING_DELETION copies of it, so the ONLINE one is preferred.
    private static final String HOSTNAME = "vm115982";
    private static final RunId RUN_ID = RunId.next();
    private static final Set<String> SOURCES = Set.of("WINGET", "CHOCOLATEY", "BREW", "UNMANAGED");
    private static final Set<String> SEVERITIES = Set.of("CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE");
    private static final Set<String> HIGH_OR_CRITICAL = Set.of("HIGH", "CRITICAL");
    private static final Set<String> DEVICE_STATUSES = Set.of("UP_TO_DATE", "OUTDATED");
    private static final String CVE_ID = "^CVE-\\d{4}-\\d{4,}$";
    private static final String NO_SUCH_CVE = "CVE-1999-99999999";

    private static Machine device;
    private static List<Software> fleetSoftware;
    private static Software vulnerableSoftware;
    private static String cveId;
    private static Machine affectedDevice;

    @BeforeAll
    public static void pickDevice() {
        device = DeviceApi.getDevices(DeviceGenerator.osDevicesFilter(WINDOWS)).stream()
                .filter(d -> HOSTNAME.equals(d.getHostname()))
                .min(Comparator.comparing((Machine d) -> d.getStatus() != DeviceStatus.ONLINE))
                .orElse(null);
    }

    @Tag("feature")
    @Test
    @DisplayName("List the software titles installed across the fleet")
    @Order(1)
    public void testListSoftware() {
        SoftwareConnection all = SoftwareInventoryApi.getSoftwares(null, null, null, null, null);
        List<Software> titles = all.nodes();
        assertThat(titles).as("Fleet reports installed software; an empty list means Fleet MDM is not connected").isNotEmpty();
        // filteredCount is every match; without `first` the server returns at most its default page, so
        // the two are equal only on a tenant small enough to fit one — true on the pipeline's fresh
        // tenant, false on the long-lived qa and stage ones (2116 titles, 5381 CVEs).
        assertThat(all.getFilteredCount()).as("filteredCount counts every matching title, not just this page")
                .isGreaterThanOrEqualTo(titles.size());
        assertThat(all.ids()).as("Every title has an id, once").doesNotContainNull().doesNotHaveDuplicates();
        assertThat(titles).allSatisfy(title -> {
            assertThat(title.getName()).as("Title %s has a name", title.getId()).isNotBlank();
            assertThat(title.getSource()).as("Title %s source", title.getName()).isIn(SOURCES);
        });
        assertThat(titles).filteredOn(title -> title.getVulnerabilitySummary() != null)
                .allSatisfy(title -> assertThat(title.cveCount()).as("A vulnerability summary is only present with CVEs: %s", title.getName()).isPositive());
        fleetSoftware = titles;
        vulnerableSoftware = titles.stream().filter(title -> title.cveCount() > 0).findFirst().orElse(null);
        // Fleet only reports CVEs some time after a host enrols, so a tenant this run registered minutes
        // ago legitimately has none yet and the cases needing one abort through requireFleetSoftware().
        // On a long-lived tenant their absence is a real finding, so the assertion still bites there.
        if (!PipelineContext.hasRegisteredTenant()) {
            assertThat(vulnerableSoftware).as("At least one installed title carries a CVE").isNotNull();
        }

        SoftwareConnection first = SoftwareInventoryApi.getSoftwares(null, null, null, 1, null);
        assertThat(first.ids()).as("first: 1 returns the first title").containsExactly(titles.getFirst().getId());
        assertThat(first.getFilteredCount()).as("filteredCount counts every title, not the page")
                .isEqualTo(all.getFilteredCount());
        assertThat(first.getPageInfo().getHasNextPage()).as("hasNextPage while titles remain").isEqualTo(titles.size() > 1);
        assumeTrue(titles.size() > 1, "Only one title, so there is no second page to read");
        SoftwareConnection second = SoftwareInventoryApi.getSoftwares(null, null, null, 1, first.getPageInfo().getEndCursor());
        assertThat(second.ids()).as("after the first page's endCursor comes the second title").containsExactly(titles.get(1).getId());
        assertThat(second.getPageInfo().getHasPreviousPage()).as("The second page has a previous page").isTrue();
    }

    @Tag("feature")
    @Test
    @Disabled("Temporary: the facets come straight from Fleet, so an empty source facet is Fleet's data, not ours")
    @DisplayName("Software facets count the fleet's titles by source, version status and severity")
    @Order(2)
    public void testSoftwareFilters() {
        requireFleetSoftware();
        SoftwareFilters filters = SoftwareInventoryApi.getSoftwareFilters(null);
        assertThat(filters.getSources()).as("Every title has a source, so the source facet is not empty").isNotEmpty();
        assertFacet(filters.getSources(), SOURCES, "sources");
        assertFacet(filters.getSeverities(), SEVERITIES, "severities");
        assertThat(filters.getVersionStatuses()).as("versionStatuses facet").allSatisfy(option -> assertThat(option.getCount()).isPositive());
        assertThat(total(filters.getSources())).as("The facets count every Fleet title; the list drops those on no OpenFrame device")
                .isGreaterThanOrEqualTo(fleetSoftware.size());

        String name = fleetSoftware.getFirst().getName();
        SoftwareFilters searched = SoftwareInventoryApi.getSoftwareFilters(name);
        assertThat(total(searched.getSources())).as("A search for \"%s\" narrows the facets to at least that title", name)
                .isPositive().isLessThanOrEqualTo(total(filters.getSources()));
    }

    @Tag("feature")
    @Test
    @Disabled("Temporary: the list order comes straight from Fleet, so the collation is Fleet's, not ours")
    @DisplayName("Search, sort and filter the software list; an unknown sort field is BAD_REQUEST")
    @Order(3)
    public void testSearchSortAndFilterSoftware() {
        requireFleetSoftware();
        Software title = fleetSoftware.getFirst();
        List<Software> found = SoftwareInventoryApi.getSoftwares(null, title.getName(), null, null, null).nodes();
        assertThat(found).extracting(Software::getId).as("Searching \"%s\" finds that title", title.getName()).contains(title.getId());

        List<String> byName = names(SoftwareInventoryApi.getSoftwares(null, null, sort("name", "ASC"), null, null).nodes());
        assertThat(byName).as("name ASC is alphabetical, ignoring case").isSortedAccordingTo(String.CASE_INSENSITIVE_ORDER);
        // devicesCount stays an advertised sort key (see the refusal message asserted below) but #2518
        // removed it from `Software`, so the order it produces cannot be read back and verified here.
        List<Integer> byCves = SoftwareInventoryApi.getSoftwares(null, null, sort("cveCount", "DESC"), null, null).nodes().stream()
                .map(Software::cveCount).toList();
        assertThat(byCves).as("cveCount DESC is most-vulnerable first").isSortedAccordingTo(Comparator.reverseOrder());

        SoftwareFilterInput vulnerable = SoftwareFilterInput.builder().minSeverity("LOW").build();
        List<Software> filtered = SoftwareInventoryApi.getSoftwares(vulnerable, null, null, null, null).nodes();
        assertThat(filtered).extracting(Software::getId).as("minSeverity LOW keeps the vulnerable title %s", vulnerableSoftware.getName())
                .contains(vulnerableSoftware.getId());
        assertThat(filtered).as("minSeverity LOW keeps only titles with CVEs").allSatisfy(row -> assertThat(row.cveCount()).isPositive());

        List<GraphqlError> errors = SoftwareInventoryApi.attemptSoftwaresErrors(sort("e2e-unknown-" + RUN_ID, "ASC"));
        assertThat(codes(errors)).as("An unknown sort field is a client error, not a server error").contains("BAD_REQUEST");
        assertThat(errors).extracting(GraphqlError::getMessage).as("The refusal lists the sortable fields")
                .anySatisfy(message -> assertThat(message).contains("name, devicesCount, cveCount, highestSeverity"));
    }

    @Tag("feature")
    @Test
    @DisplayName("Read one software title by the id the list returns; an unknown id is null")
    @Order(4)
    public void testGetSoftware() {
        requireFleetSoftware();
        Software listed = vulnerableSoftware;
        Software fetched = SoftwareInventoryApi.getSoftware(listed.getId());
        assertThat(fetched).as("software(id) finds %s", listed.getName()).isNotNull();
        assertThat(fetched.getId()).as("software(id) returns the requested title").isEqualTo(listed.getId());
        assertThat(fetched.getName()).as("The title's name matches the list").isEqualTo(listed.getName());
        assertThat(fetched.getSource()).as("The title's source matches the list").isEqualTo(listed.getSource());
        assertThat(fetched.cveCount()).as("The title's CVE count matches the list").isEqualTo(listed.cveCount());

        assertThat(SoftwareInventoryApi.getSoftware("999999999")).as("An id Fleet does not hold is null").isNull();
    }

    @Tag("feature")
    @Test
    @DisplayName("List the devices holding a software title, with per-device version and status facets")
    @Order(5)
    public void testSoftwareDevices() {
        requireFleetSoftware();
        Software title = vulnerableSoftware;
        SoftwareOnDeviceConnection holders = SoftwareInventoryApi.getSoftwareDevices(title.getId(), null, null);
        List<SoftwareOnDevice> rows = holders.nodes();
        assertThat(rows).as("%s is installed somewhere", title.getName()).isNotEmpty();
        assertThat(holders.getFilteredCount()).as("Without first, one page holds every row").isEqualTo(rows.size());
        assertThat(rows).allSatisfy(row -> {
            assertThat(row.getDevice().getMachineId()).as("Each row is an OpenFrame device").isNotBlank();
            assertThat(row.getSoftwareVersion()).as("Each row has the version on that device").isNotBlank();
            assertThat(row.getStatus()).as("Each row is UP_TO_DATE or OUTDATED against the latest version").isIn(DEVICE_STATUSES);
        });
        SoftwareOnDeviceFilters facets = SoftwareInventoryApi.getSoftwareDeviceFilters(title.getId());
        assertFacet(facets.getStatuses(), DEVICE_STATUSES, "statuses");
        assertThat(total(facets.getStatuses())).as("The status facet counts every row of the tab").isEqualTo(rows.size());
        for (FilterOption option : facets.getStatuses()) {
            SoftwareOnDeviceFilterInput byStatus = SoftwareOnDeviceFilterInput.builder().statuses(List.of(option.getValue())).build();
            List<SoftwareOnDevice> matching = SoftwareInventoryApi.getSoftwareDevices(title.getId(), byStatus, null).nodes();
            assertThat(matching).as("Filtering by %s returns as many rows as its facet counts", option.getValue()).hasSize(option.getCount());
            assertThat(matching).extracting(SoftwareOnDevice::getStatus).as("Filtering by %s", option.getValue()).containsOnly(option.getValue());
        }

        String hostname = rows.getFirst().getDevice().getHostname();
        List<SoftwareOnDevice> searched = SoftwareInventoryApi.getSoftwareDevices(title.getId(), null, hostname).nodes();
        assertThat(searched).extracting(row -> row.getDevice().getHostname()).as("A hostname search finds %s", hostname).contains(hostname);

        assertThat(rows).extracting(row -> row.getDevice().getMachineId() + "@" + row.getSoftwareVersion())
                .as("One row per device and installed version").doesNotHaveDuplicates();
    }

    @Tag("feature")
    @Test
    @DisplayName("List the CVEs of a software title")
    @Order(6)
    public void testSoftwareVulnerabilities() {
        requireFleetSoftware();
        Software title = vulnerableSoftware;
        SoftwareVulnerabilityConnection cves = SoftwareInventoryApi.getSoftwareVulnerabilities(title.getId(), null, null);
        List<SoftwareVulnerability> rows = cves.nodes();
        assertThat(rows).as("%s has %d CVEs in the list, so its tab is not empty", title.getName(), title.cveCount()).isNotEmpty();
        assertThat(cves.getFilteredCount()).as("Without first, one page holds every row").isEqualTo(rows.size());
        assertThat(rows).extracting(SoftwareVulnerability::getCveId).as("One row per CVE").doesNotHaveDuplicates()
                .allSatisfy(id -> assertThat(id).matches(CVE_ID));
        assertThat(rows.size()).as("Distinct CVEs never exceed the title's per-version CVE count").isLessThanOrEqualTo(title.cveCount());
        assertThat(rows).allSatisfy(row -> assertThat(row.getAffectedVersion()).as("%s names the affected version", row.getCveId()).isNotBlank());

        List<Double> ascending = SoftwareInventoryApi.getSoftwareVulnerabilities(title.getId(), null, sort("severity", "ASC")).nodes().stream()
                .map(SoftwareVulnerability::getCvssScore).toList();
        assertThat(ascending).as("severity ASC orders by CVSS score, unscored last")
                .isSortedAccordingTo(Comparator.nullsLast(Comparator.naturalOrder()));

        String cve = rows.getFirst().getCveId();
        assertThat(SoftwareInventoryApi.getSoftwareVulnerabilities(title.getId(), cve, null).nodes())
                .extracting(SoftwareVulnerability::getCveId).as("Searching %s finds exactly that CVE", cve).containsExactly(cve);
    }

    @Tag("feature")
    @Test
    @DisplayName("List the CVEs across the fleet; detail-only fields stay null on list rows")
    @Order(7)
    public void testListVulnerabilities() {
        VulnerabilityConnection all = SoftwareInventoryApi.getVulnerabilities(null, null, null);
        List<Vulnerability> rows = all.nodes();
        assumeTrue(!rows.isEmpty() || !PipelineContext.hasRegisteredTenant(),
                "Fleet has not finished scanning the host this run enrolled, so it reports no CVEs yet");
        assertThat(rows).as("Fleet reports CVEs on the tenant's devices").isNotEmpty();
        assertThat(all.getFilteredCount()).as("filteredCount counts every matching CVE, not just this page")
                .isGreaterThanOrEqualTo(rows.size());
        assertThat(all.cveIds()).as("One row per CVE").doesNotHaveDuplicates().allSatisfy(id -> assertThat(id).matches(CVE_ID));
        assertThat(rows).allSatisfy(row -> {
            assertThat(row.getDevicesCount()).as("%s affects at least one OpenFrame device", row.getCveId()).isPositive();
            assertThat(row.getDescription()).as("description is detail-only: %s", row.getCveId()).isNull();
            assertThat(row.getResolvedInVersion()).as("resolvedInVersion is detail-only: %s", row.getCveId()).isNull();
            assertThat(row.getAffectedSoftware()).as("affectedSoftware is detail-only: %s", row.getCveId()).isNull();
        });
        cveId = rows.getFirst().getCveId();

        VulnerabilityFilters facets = SoftwareInventoryApi.getVulnerabilityFilters();
        assertFacet(facets.getSeverities(), SEVERITIES, "severities");
        long scored = rows.stream().filter(row -> row.getSeverity() != null).count();
        assertThat(total(facets.getSeverities())).as("The severity facet counts every scored Fleet CVE, at least the %d listed", scored)
                .isGreaterThanOrEqualTo((int) scored);

        List<Vulnerability> severe = SoftwareInventoryApi.getVulnerabilities(VulnerabilityFilterInput.builder().minSeverity("HIGH").build(), null, null).nodes();
        assertThat(severe).extracting(Vulnerability::getSeverity).as("minSeverity HIGH keeps only HIGH and CRITICAL").allSatisfy(s -> assertThat(s).isIn(HIGH_OR_CRITICAL));
        long expected = rows.stream().filter(row -> row.getSeverity() != null && HIGH_OR_CRITICAL.contains(row.getSeverity())).count();
        assertThat(severe).as("minSeverity HIGH drops nothing HIGH or CRITICAL").hasSize((int) expected);

        List<String> byCve = SoftwareInventoryApi.getVulnerabilities(null, sort("cveId", "ASC"), null).cveIds();
        assertThat(byCve).as("cveId ASC is Fleet's CVE order, keeping every listed CVE").isSorted().hasSize(rows.size());

        VulnerabilityConnection page = SoftwareInventoryApi.getVulnerabilities(null, null, 1);
        assertThat(page.cveIds()).as("first: 1 returns the first CVE").containsExactly(cveId);
        assertThat(page.getFilteredCount()).as("filteredCount counts every CVE, not the page")
                .isEqualTo(all.getFilteredCount());
    }

    @Tag("feature")
    @Test
    @DisplayName("Read one CVE with its affected software and devices; an unknown CVE is null")
    @Order(8)
    public void testGetVulnerability() {
        requireCve();
        Vulnerability detail = SoftwareInventoryApi.getVulnerability(cveId);
        assertThat(detail).as("vulnerability(%s) finds the listed CVE", cveId).isNotNull();
        assertThat(detail.getCveId()).as("vulnerability returns the requested CVE").isEqualTo(cveId);
        assertThat(detail.getDevicesCount()).as("%s affects at least one device", cveId).isPositive();
        assertThat(detail.getAffectedSoftware()).as("The detail resolves the software %s hits (regressed before 03944fa32)", cveId).isNotEmpty();
        assertThat(detail.getAffectedSoftware()).allSatisfy(affected -> {
            assertThat(affected.getId()).as("Affected software has an id").isNotBlank();
            assertThat(affected.getName()).as("Affected software has a name").isNotBlank();
            assertThat(affected.getDevicesCount()).as("%s is on at least one affected device", affected.getName()).isPositive();
        });

        DeviceConnection devices = SoftwareInventoryApi.getVulnerabilityDevices(cveId);
        List<Machine> machines = devices.getEdges().stream().map(DeviceEdge::getNode).toList();
        assertThat(machines).as("vulnerabilityDevices(%s) lists the affected devices (regressed before 03944fa32)", cveId).isNotEmpty();
        assertThat(devices.getFilteredCount()).as("Without first, one page holds every device").isEqualTo(machines.size());
        assertThat(machines).extracting(Machine::getMachineId).as("Each affected device is an OpenFrame device, once")
                .doesNotContainNull().doesNotHaveDuplicates();
        assertThat(machines).as("vulnerability.devicesCount counts the devices vulnerabilityDevices lists").hasSize(detail.getDevicesCount());
        affectedDevice = machines.getFirst();

        assertThat(SoftwareInventoryApi.getVulnerability(NO_SUCH_CVE)).as("A CVE Fleet has no record of is null").isNull();
        assertThat(SoftwareInventoryApi.getVulnerabilityDevices(NO_SUCH_CVE).getEdges()).as("A CVE on no device has no devices").isEmpty();
    }

    @Tag("feature")
    @Tag("needs-device")
    @Test
    @DisplayName("List the software installed on vm115982, versions in the device's scope")
    @Order(9)
    public void testDeviceSoftware() {
        requireDevice();
        SoftwareConnection installed = SoftwareInventoryApi.getDeviceSoftware(device.getMachineId(), null, null, null);
        List<Software> rows = installed.nodes();
        assertThat(rows).as("Fleet reports software on %s; empty means its Fleet host is not connected", HOSTNAME).isNotEmpty();
        assertThat(installed.getFilteredCount()).as("Without first, one page holds every title").isEqualTo(rows.size());
        assertThat(rows).allSatisfy(row -> {
            assertThat(row.getName()).as("Title %s has a name", row.getId()).isNotBlank();
            assertThat(row.getSource()).as("%s source", row.getName()).isIn(SOURCES);
        });
        assertThat(names(rows)).as("The default order is name, ignoring case").isSortedAccordingTo(String.CASE_INSENSITIVE_ORDER);

        Software here = rows.stream().filter(row -> row.getCurrentVersion() != null).findFirst().orElseThrow();
        List<SoftwareOnDevice> holders = SoftwareInventoryApi.getSoftwareDevices(here.getId(), null, HOSTNAME).nodes();
        assertThat(holders).filteredOn(row -> device.getMachineId().equals(row.getDevice().getMachineId()))
                .extracting(SoftwareOnDevice::getSoftwareVersion)
                .as("currentVersion of %s is the version installed on %s", here.getName(), HOSTNAME).contains(here.getCurrentVersion());

        assertThat(codes(SoftwareInventoryApi.attemptDeviceSoftwareErrors(device.getMachineId(), sort("e2e-unknown-" + RUN_ID, "ASC"))))
                .as("An unknown sort field is BAD_REQUEST").contains("BAD_REQUEST");

        SoftwareFilters facets = SoftwareInventoryApi.getDeviceSoftwareFilters(device.getMachineId(), null);
        assertFacet(facets.getSources(), SOURCES, "sources");
        assertThat(total(facets.getSources())).as("The source facet counts every title on the device").isEqualTo(rows.size());
        FilterOption source = facets.getSources().getFirst();
        SoftwareFilterInput bySource = SoftwareFilterInput.builder().sources(List.of(source.getValue())).build();
        List<Software> ofSource = SoftwareInventoryApi.getDeviceSoftware(device.getMachineId(), bySource, null, null).nodes();
        assertThat(ofSource).as("Filtering by %s returns as many titles as its facet counts", source.getValue()).hasSize(source.getCount());
        assertThat(ofSource).extracting(Software::getSource).as("Filtering by %s", source.getValue()).containsOnly(source.getValue());

        String needle = here.getName();
        List<Software> searched = SoftwareInventoryApi.getDeviceSoftware(device.getMachineId(), null, needle, null).nodes();
        assertThat(searched).extracting(Software::getId).as("Searching \"%s\" finds it", needle).contains(here.getId());
        assertThat(total(SoftwareInventoryApi.getDeviceSoftwareFilters(device.getMachineId(), needle).getSources()))
                .as("The facets share deviceSoftware's search scope").isEqualTo(searched.size());
    }

    @Tag("feature")
    @Test
    @DisplayName("List the CVEs present on an affected device, each with the affected software on that host")
    @Order(10)
    public void testDeviceVulnerabilities() {
        requireAffectedDevice();
        String machineId = affectedDevice.getMachineId();
        VulnerabilityConnection present = SoftwareInventoryApi.getDeviceVulnerabilities(machineId, null, null, null);
        List<Vulnerability> rows = present.nodes();
        assertThat(present.cveIds()).as("%s, affected by %s, lists it", affectedDevice.getHostname(), cveId).contains(cveId);
        assertThat(present.getFilteredCount()).as("filteredCount counts every matching CVE, not just this page")
                .isGreaterThanOrEqualTo(rows.size());
        assertThat(present.cveIds()).as("One row per CVE").doesNotHaveDuplicates().allSatisfy(id -> assertThat(id).matches(CVE_ID));
        assertThat(rows).allSatisfy(row -> {
            assertThat(row.getAffectedSoftware()).as("affectedSoftware is populated on every row: %s", row.getCveId()).isNotEmpty();
            // #2518: the fleet-wide count would cost one Fleet call per row, so it is left null here.
            assertThat(row.getDevicesCount()).as("devicesCount is not populated in a device scope: %s", row.getCveId()).isNull();
        });
        assertThat(affectedSoftwareIds(rows)).as("affectedSoftware is scoped to %s: exactly its titles with CVEs", affectedDevice.getHostname())
                .isEqualTo(vulnerableTitleIds(SoftwareInventoryApi.getDeviceSoftware(machineId, null, null, null).nodes()));
        assertThat(rows).extracting(Vulnerability::getCvssScore).as("The default order is severity DESC, unscored last")
                .isSortedAccordingTo(Comparator.nullsLast(Comparator.<Double>reverseOrder()));

        VulnerabilityFilters facets = SoftwareInventoryApi.getDeviceVulnerabilityFilters(machineId, null);
        assertFacet(facets.getSeverities(), SEVERITIES, "severities");
        assertThat(total(facets.getSeverities())).as("The severity facet counts every scored CVE on the device").isEqualTo(scored(rows));
        VulnerabilityFilterInput severe = VulnerabilityFilterInput.builder().minSeverity("HIGH").build();
        List<Vulnerability> highOrCritical = SoftwareInventoryApi.getDeviceVulnerabilities(machineId, severe, null, null).nodes();
        int facetHighOrCritical = facets.getSeverities().stream().filter(option -> HIGH_OR_CRITICAL.contains(option.getValue()))
                .mapToInt(FilterOption::getCount).sum();
        assertThat(highOrCritical).as("minSeverity HIGH returns what the HIGH and CRITICAL facets count").hasSize(facetHighOrCritical);

        List<String> discovered = SoftwareInventoryApi.getDeviceVulnerabilities(machineId, null, null, sort("discoveredAt", "ASC")).nodes().stream()
                .map(Vulnerability::getDiscoveredAt).filter(Objects::nonNull).toList();
        assertThat(discovered).as("discoveredAt ASC is oldest first").isSorted();
        assertThat(SoftwareInventoryApi.getDeviceVulnerabilities(machineId, null, cveId, null).cveIds())
                .as("Searching %s finds exactly that CVE", cveId).containsExactly(cveId);
        assertThat(total(SoftwareInventoryApi.getDeviceVulnerabilityFilters(machineId, cveId).getSeverities()))
                .as("The facets share deviceVulnerabilities' search scope").isLessThanOrEqualTo(1);
        assertThat(codes(SoftwareInventoryApi.attemptDeviceVulnerabilitiesErrors(machineId, sort("e2e-unknown-" + RUN_ID, "ASC"))))
                .as("An unknown sort field is BAD_REQUEST").contains("BAD_REQUEST");
    }

    @Tag("feature")
    @Tag("needs-device")
    @Test
    @DisplayName("vm115982's CVE list holds exactly its vulnerable titles; with none it is empty, not an error")
    @Order(11)
    public void testDeviceVulnerabilitiesMatchInstalledSoftware() {
        requireDevice();
        VulnerabilityConnection present = SoftwareInventoryApi.getDeviceVulnerabilities(device.getMachineId(), null, null, null);
        List<Vulnerability> rows = present.nodes();
        Set<String> vulnerableHere = vulnerableTitleIds(SoftwareInventoryApi.getDeviceSoftware(device.getMachineId(), null, null, null).nodes());
        assertThat(affectedSoftwareIds(rows)).as("The CVEs on %s hit exactly its %d titles with CVEs", HOSTNAME, vulnerableHere.size())
                .isEqualTo(vulnerableHere);
        assertThat(present.getFilteredCount()).as("filteredCount counts every CVE on the device, not the page")
                .isGreaterThanOrEqualTo(rows.size());
        assertThat(rows).allSatisfy(row -> assertThat(row.getAffectedSoftware()).as("affectedSoftware of %s", row.getCveId()).isNotEmpty());
        VulnerabilityFilters facets = SoftwareInventoryApi.getDeviceVulnerabilityFilters(device.getMachineId(), null);
        assertThat(total(facets.getSeverities())).as("The severity facet counts the scored CVEs on %s, none when it has none", HOSTNAME)
                .isEqualTo(scored(rows));
    }

    @Tag("feature")
    @Test
    @DisplayName("An unknown machineId is NOT_FOUND on all four device-scoped reads")
    @Order(12)
    public void testUnknownDeviceNotFound() {
        String unknown = "e2e-no-such-machine-" + RUN_ID;
        assertThat(codes(SoftwareInventoryApi.attemptDeviceSoftwareErrors(unknown, null))).as("deviceSoftware").contains("NOT_FOUND");
        assertThat(codes(SoftwareInventoryApi.attemptDeviceSoftwareFiltersErrors(unknown))).as("deviceSoftwareFilters").contains("NOT_FOUND");
        assertThat(codes(SoftwareInventoryApi.attemptDeviceVulnerabilitiesErrors(unknown, null))).as("deviceVulnerabilities").contains("NOT_FOUND");
        assertThat(codes(SoftwareInventoryApi.attemptDeviceVulnerabilityFiltersErrors(unknown))).as("deviceVulnerabilityFilters").contains("NOT_FOUND");
    }

    private static void assertFacet(List<FilterOption> options, Set<String> allowed, String facet) {
        assertThat(options).as("%s facet", facet).allSatisfy(option -> {
            assertThat(option.getValue()).as("%s value", facet).isIn(allowed);
            assertThat(option.getLabel()).as("%s label of %s", facet, option.getValue()).isEqualTo(humanize(option.getValue()));
            assertThat(option.getCount()).as("%s count of %s", facet, option.getValue()).isPositive();
        });
        assertThat(options).extracting(FilterOption::getValue).as("%s values are distinct", facet).doesNotHaveDuplicates();
    }

    private static Set<String> affectedSoftwareIds(List<Vulnerability> rows) {
        return rows.stream().flatMap(row -> row.getAffectedSoftware().stream()).map(AffectedSoftware::getId).collect(Collectors.toSet());
    }

    private static Set<String> vulnerableTitleIds(List<Software> titles) {
        return titles.stream().filter(title -> title.cveCount() > 0).map(Software::getId).collect(Collectors.toSet());
    }

    private static int scored(List<Vulnerability> rows) {
        return (int) rows.stream().filter(row -> row.getSeverity() != null).count();
    }

    private static String humanize(String value) {
        String lower = value.toLowerCase(Locale.ROOT).replace('_', ' ');
        return Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }

    private static int total(Collection<FilterOption> options) {
        return options.stream().mapToInt(FilterOption::getCount).sum();
    }

    private static List<String> names(List<Software> titles) {
        return titles.stream().map(Software::getName).toList();
    }

    private static SortInput sort(String field, String direction) {
        return SortInput.builder().field(field).direction(direction).build();
    }

    // Codes of the errors that carry one; graphql-java's code-less errors are dropped.
    private static List<Object> codes(List<GraphqlError> errors) {
        return errors.stream()
                .map(error -> error.getExtensions() == null ? null : error.getExtensions().get("code"))
                .filter(Objects::nonNull)
                .toList();
    }

    private static void requireFleetSoftware() {
        assumeTrue(fleetSoftware != null && vulnerableSoftware != null,
                "No vulnerable software title was listed in \"List the software titles installed across the fleet\"; see that case");
    }

    private static void requireCve() {
        assumeTrue(cveId != null, "No CVE was listed in \"List the CVEs across the fleet\"; see that case");
    }

    private static void requireAffectedDevice() {
        assumeTrue(affectedDevice != null, "No affected device was listed in \"Read one CVE with its affected software and devices\"; see that failure");
    }

    private static void requireDevice() {
        assumeTrue(device != null, HOSTNAME + " is not listed among the tenant's Windows devices");
    }
}
