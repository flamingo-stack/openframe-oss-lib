package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceResponse;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceStatus;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareSource;
import com.openframe.api.dto.rmm.software.SoftwareType;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilityResponse;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.document.rmm.software.Vulnerability;
import com.openframe.data.document.rmm.software.Software;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.PackageAutoUpdatePolicyRepository;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.repository.rmm.software.VulnerabilityRepository;
import com.openframe.data.repository.rmm.software.SoftwareRepository;
import com.openframe.data.repository.rmm.software.SoftwareTitleQuery;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.software.PackageMatchState;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import com.openframe.data.document.rmm.software.SoftwarePackageMatch;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TenantSoftwareReadModelQueryTest {

    private static final String TENANT = "t1";
    private static final Set<String> MANAGER_SOURCES = Set.of("homebrew_packages", "chocolatey_packages", "winget_packages");

    @Mock private SoftwareRepository softwareRepository;
    @Mock private DeviceSoftwareRepository deviceSoftwareRepository;
    @Mock private VulnerabilityRepository vulnerabilityRepository;
    @Mock private MachineRepository machineRepository;
    @Mock private PackageAutoUpdatePolicyRepository packageAutoUpdatePolicyRepository;

    @InjectMocks private TenantSoftwareReadModelQuery query;

    private static SoftwareTitleQuery.SoftwareTitleQueryBuilder titles() {
        return SoftwareTitleQuery.builder().tenantId(TENANT).managerSources(MANAGER_SOURCES);
    }

    private static Software software(long titleId, String source) {
        return software(titleId, source, 0);
    }

    private static Software software(long titleId, String source, int devicesCount) {
        return Software.builder()
                .tenantId(TENANT).softwareTitleId(titleId).name("jq").source(source)
                .latestVersion("1.7").devicesCount(devicesCount).cveCount(2)
                .build();
    }

    private static DeviceSoftware installed(String machineId, String... versions) {
        return DeviceSoftware.builder().tenantId(TENANT).machineId(machineId).softwareTitleId(42L)
                .machineConnected(true).versions(List.of(versions)).build();
    }

    private static Machine machine(String machineId, String hostname) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        machine.setHostname(hostname);
        return machine;
    }

    @Test
    void exists_notANumber_isFalseWithoutQuerying() {
        assertThat(query.exists(TENANT, "abc")).isFalse();
        assertThat(query.exists(TENANT, " ")).isFalse();
        verifyNoInteractions(softwareRepository);
    }

    @Test
    void exists_asksTheRepositoryForTheTitle() {
        when(softwareRepository.existsByTenantIdAndSoftwareTitleId(TENANT, 42L)).thenReturn(true);

        assertThat(query.exists(TENANT, " 42 ")).isTrue();
    }

    @Test
    void get_takesTheProjectedCurrentAndOlderVersions() {
        Software jq = software(42L, "homebrew_packages", 1);
        jq.setCurrentVersion("1.7");
        jq.setOlderVersionsCount(2);
        when(softwareRepository.findByTenantIdAndSoftwareTitleId(TENANT, 42L)).thenReturn(Optional.of(jq));

        SoftwareResponse row = query.get(TENANT, "42");

        assertThat(row.getCurrentVersion()).isEqualTo("1.7");
        assertThat(row.getOlderVersionsCount()).isEqualTo(2);
    }

    @Test
    void get_projectedWithoutVersions_noCurrentVersion() {
        Software jq = software(42L, "homebrew_packages", 1);
        jq.setOlderVersionsCount(0);
        when(softwareRepository.findByTenantIdAndSoftwareTitleId(TENANT, 42L)).thenReturn(Optional.of(jq));

        SoftwareResponse row = query.get(TENANT, "42");

        assertThat(row.getCurrentVersion()).isNull();
        assertThat(row.getOlderVersionsCount()).isZero();
    }

    @Test
    void get_notProjectedWithVersionCountsYet_reportsNoVersionsInUse() {
        Software jq = software(42L, "homebrew_packages", 3);
        when(softwareRepository.findByTenantIdAndSoftwareTitleId(TENANT, 42L)).thenReturn(Optional.of(jq));

        SoftwareResponse row = query.get(TENANT, "42");

        assertThat(row.getId()).isEqualTo("42");
        assertThat(row.getSource()).isEqualTo(SoftwareSource.BREW);
        assertThat(row.getType()).isEqualTo(SoftwareType.PACKAGE);
        assertThat(row.getCurrentVersion()).isNull();
        assertThat(row.getOlderVersionsCount()).isNull();
        assertThat(row.getLatestVersion()).isEqualTo("1.7");
        assertThat(row.getDevicesCount()).isEqualTo(3);
        assertThat(row.getVulnerabilitySummary().getCveCount()).isEqualTo(2);
    }

    @Test
    void get_unknownOrInvalidId_throwsNotFound() {
        when(softwareRepository.findByTenantIdAndSoftwareTitleId(TENANT, 7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> query.get(TENANT, "7")).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> query.get(TENANT, "x")).isInstanceOf(NotFoundException.class);
    }

    @Test
    void listSoftware_searchAndVulnerable_narrowTheQuery_sortedAndPaged() {
        Software one = software(1L, "apps", 1);
        Page<Software> page = new PageImpl<>(List.of(one), PageRequest.of(1, 1), 3);
        when(softwareRepository.findTitles(any(SoftwareTitleQuery.class), any(Pageable.class))).thenReturn(page);
        SortInput sort = new SortInput();
        sort.setField("devicesCount");
        sort.setDirection(SortDirection.DESC);

        PageResult<SoftwareResponse> result = query.listSoftware(TENANT, "JQ", 1, 1, sort, true, null);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(softwareRepository).findTitles(eq(titles().nameLower("jq").vulnerableOnly(true).build()),
                pageable.capture());
        assertThat(pageable.getValue().getSort()).isEqualTo(Sort.by(Sort.Direction.DESC, "devicesCount"));
        assertThat(pageable.getValue().getPageSize()).isEqualTo(1);
        assertThat(result.items()).extracting(SoftwareResponse::getId).containsExactly("1");
        assertThat(result.filteredCount()).isEqualTo(3);
        assertThat(result.hasNext()).isTrue();
        assertThat(result.hasPrevious()).isTrue();
    }

    @Test
    void listSoftware_noSearchNoFlags_allWithDevices_byNameAscending() {
        when(softwareRepository.findTitles(any(SoftwareTitleQuery.class), any(Pageable.class))).thenReturn(Page.empty());

        query.listSoftware(TENANT, null, 0, null, null, null, null);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(softwareRepository).findTitles(eq(titles().build()),
                pageable.capture());
        assertThat(pageable.getValue().getSort()).isEqualTo(Sort.by(Sort.Direction.ASC, "nameLower"));
        assertThat(pageable.getValue().getPageSize()).isEqualTo(20);
    }

    // a blank search is no search; the manageable flag reaches the query as it is, true or false
    @Test
    void listSoftware_blankSearch_manageableFlag_passedToTheQuery() {
        when(softwareRepository.findTitles(any(SoftwareTitleQuery.class), any(Pageable.class))).thenReturn(Page.empty());

        SoftwareFilterInput manageable = new SoftwareFilterInput();
        manageable.setManageable(true);
        SoftwareFilterInput notManageable = new SoftwareFilterInput();
        notManageable.setManageable(false);

        query.listSoftware(TENANT, " ", 0, 10, null, false, manageable);
        query.listSoftware(TENANT, "jq", 0, 10, null, null, notManageable);

        verify(softwareRepository).findTitles(eq(titles().manageable(true).build()),
                any(Pageable.class));
        verify(softwareRepository).findTitles(eq(titles().nameLower("jq").manageable(false).build()),
                any(Pageable.class));
    }

    @Test
    void devicesForSoftwareRows_statusAgainstTheGivenLatest_allVersionsMustReachIt() {
        when(softwareRepository.findByTenantIdAndSoftwareTitleId(TENANT, 42L)).thenReturn(Optional.of(software(42L, "apps")));
        when(deviceSoftwareRepository.findByTenantIdAndSoftwareTitleIdAndMachineConnectedTrueOrderByMachineIdAsc(TENANT, 42L))
                .thenReturn(List.of(installed("m1", "10.0"), installed("m2", "9.0"), installed("m3", "10.0", "9.0"),
                        installed("gone", "10.0")));
        Machine alpha = machine("m1", "alpha");
        Machine beta = machine("m2", "beta");
        Machine gamma = machine("m3", "gamma");
        when(machineRepository.findByMachineIdIn(anyList())).thenReturn(List.of(alpha, beta, gamma));

        List<SoftwareOnDeviceResponse> rows = query.devicesForSoftwareRows(TENANT, "42", null, "10.0");

        assertThat(rows).extracting(row -> row.getDevice().getMachineId(), SoftwareOnDeviceResponse::getStatus,
                        SoftwareOnDeviceResponse::getSoftwareVersion)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("m1", SoftwareOnDeviceStatus.UP_TO_DATE, "10.0"),
                        org.assertj.core.groups.Tuple.tuple("m2", SoftwareOnDeviceStatus.OUTDATED, "9.0"),
                        org.assertj.core.groups.Tuple.tuple("m3", SoftwareOnDeviceStatus.OUTDATED, "10.0, 9.0"));
    }

    @Test
    void devicesForSoftwareRows_unknownTitle_throwsNotFoundWithoutReadingDevices() {
        when(softwareRepository.findByTenantIdAndSoftwareTitleId(TENANT, 42L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> query.devicesForSoftwareRows(TENANT, "42", null, null))
                .isInstanceOf(NotFoundException.class);
        verifyNoInteractions(deviceSoftwareRepository);
    }

    @Test
    void devicesForSoftwareRows_aDeviceWithoutVersions_showsNoVersionAndIsOutdated() {
        when(softwareRepository.findByTenantIdAndSoftwareTitleId(TENANT, 42L)).thenReturn(Optional.of(software(42L, "apps")));
        DeviceSoftware noVersions = installed("m1");
        noVersions.setVersions(null);
        when(deviceSoftwareRepository.findByTenantIdAndSoftwareTitleIdAndMachineConnectedTrueOrderByMachineIdAsc(TENANT, 42L))
                .thenReturn(List.of(noVersions));
        when(machineRepository.findByMachineIdIn(List.of("m1"))).thenReturn(List.of(machine("m1", "alpha")));

        SoftwareOnDeviceResponse row = query.devicesForSoftwareRows(TENANT, "42", null, "1.0").getFirst();

        assertThat(row.getSoftwareVersion()).isNull();
        assertThat(row.getStatus()).isEqualTo(SoftwareOnDeviceStatus.OUTDATED);
    }

    @Test
    void devicesForSoftwareRows_searchByHostname_noLatestMeansOutdated() {
        when(softwareRepository.findByTenantIdAndSoftwareTitleId(TENANT, 42L)).thenReturn(Optional.of(software(42L, "apps")));
        when(deviceSoftwareRepository.findByTenantIdAndSoftwareTitleIdAndMachineConnectedTrueOrderByMachineIdAsc(TENANT, 42L))
                .thenReturn(List.of(installed("m1", "1.0"), installed("m2", "1.0")));
        when(machineRepository.findByMachineIdIn(anyList())).thenReturn(List.of(
                machine("m1", "Alpha-laptop"), machine("m2", "beta")));

        List<SoftwareOnDeviceResponse> rows = query.devicesForSoftwareRows(TENANT, "42", "ALPHA", null);

        assertThat(rows).extracting(row -> row.getDevice().getMachineId()).containsExactly("m1");
        assertThat(rows.getFirst().getStatus()).isEqualTo(SoftwareOnDeviceStatus.OUTDATED);
    }

    @Test
    void listVulnerabilitiesForSoftware_searchSortAndAffectedVersion() {
        Vulnerability older = Vulnerability.builder().cveId("CVE-2024-1").discoveredAt(Instant.parse("2024-01-01T00:00:00Z"))
                .affectedSoftware(List.of(Vulnerability.AffectedSoftware.builder().softwareTitleId(99L).installedVersion("x").build(),
                        Vulnerability.AffectedSoftware.builder().softwareTitleId(42L).installedVersion("1.6").build()))
                .build();
        Vulnerability newer = Vulnerability.builder().cveId("CVE-2025-2").discoveredAt(Instant.parse("2025-01-01T00:00:00Z"))
                .build();
        Vulnerability other = Vulnerability.builder().cveId("GHSA-1").build();
        when(vulnerabilityRepository.findByTenantIdAndAffectedSoftwareSoftwareTitleId(TENANT, 42L))
                .thenReturn(List.of(older, newer, other));

        PageResult<SoftwareVulnerabilityResponse> byDate = query.listVulnerabilitiesForSoftware(TENANT, "42", "cve", 0, 10, null, false);
        PageResult<SoftwareVulnerabilityResponse> byId = query.listVulnerabilitiesForSoftware(TENANT, "42", null, 0, 2, "cveId", true);

        assertThat(byDate.items()).extracting(SoftwareVulnerabilityResponse::getCveId).containsExactly("CVE-2025-2", "CVE-2024-1");
        assertThat(byDate.items().get(1).getAffectedVersion()).isEqualTo("1.6");
        assertThat(byId.items()).extracting(SoftwareVulnerabilityResponse::getCveId).containsExactly("CVE-2024-1", "CVE-2025-2");
        assertThat(byId.hasNext()).isTrue();
        assertThat(query.listVulnerabilitiesForSoftware(TENANT, "x", null, 0, 10, null, true).items()).isEmpty();
    }

    @ParameterizedTest
    @MethodSource("sourcesAndTheirQuery")
    void listSoftware_sourcesFilter_installerSourcesAndMatchedAndUnmanagedReachTheQuery(
            List<SoftwareSource> sources, Set<String> installerSources, boolean matchedChosen, boolean unmanagedChosen) {
        // setup
        when(softwareRepository.findTitles(any(SoftwareTitleQuery.class), any(Pageable.class))).thenReturn(Page.empty());
        SoftwareFilterInput filter = new SoftwareFilterInput();
        filter.setSources(sources);
        SoftwareTitleQuery expected = titles().installerSources(installerSources).matchedChosen(matchedChosen)
                .unmanagedChosen(unmanagedChosen).build();

        // execution
        query.listSoftware(TENANT, null, 0, 10, null, null, filter);

        // verifications
        verify(softwareRepository).findTitles(eq(expected), any(Pageable.class));
    }

    @ParameterizedTest
    @MethodSource("osTypesAndTheirSources")
    void listSoftware_osTypesFilter_fleetSourcesOfTheSystemsReachTheQuery(List<OsType> osTypes, Set<String> osSources) {
        // setup
        when(softwareRepository.findTitles(any(SoftwareTitleQuery.class), any(Pageable.class))).thenReturn(Page.empty());
        SoftwareFilterInput filter = new SoftwareFilterInput();
        filter.setOsTypes(osTypes);
        SoftwareTitleQuery expected = titles().osSources(osSources).build();

        // execution
        query.listSoftware(TENANT, null, 0, 10, null, null, filter);

        // verifications
        verify(softwareRepository).findTitles(eq(expected), any(Pageable.class));
    }

    @Test
    void listSoftware_autoUpdateStatusesFilter_titleIdsOfThePoliciesReachTheQuery() {
        // setup
        when(softwareRepository.findTitles(any(SoftwareTitleQuery.class), any(Pageable.class))).thenReturn(Page.empty());
        when(packageAutoUpdatePolicyRepository.findSoftwareIds(TENANT, true)).thenReturn(List.of("7"));
        when(packageAutoUpdatePolicyRepository.findSoftwareIds(TENANT, false)).thenReturn(List.of("7", "9", "not-a-title"));
        List<SoftwareAutoUpdateStatus> statuses = List.of(SoftwareAutoUpdateStatus.ON, SoftwareAutoUpdateStatus.OFF);
        SoftwareFilterInput filter = new SoftwareFilterInput();
        filter.setAutoUpdateStatuses(statuses);
        SoftwareTitleQuery expected = titles().autoUpdateStatuses(statuses)
                .enabledPolicyTitleIds(Set.of(7L)).policyTitleIds(Set.of(7L, 9L)).build();

        // execution
        query.listSoftware(TENANT, null, 0, 10, null, null, filter);

        // verifications
        verify(softwareRepository).findTitles(eq(expected), any(Pageable.class));
    }

    @Test
    void listSoftware_everyFilterWithManageable_allReachTheQuery() {
        // setup
        when(softwareRepository.findTitles(any(SoftwareTitleQuery.class), any(Pageable.class))).thenReturn(Page.empty());
        when(packageAutoUpdatePolicyRepository.findSoftwareIds(TENANT, true)).thenReturn(List.of());
        when(packageAutoUpdatePolicyRepository.findSoftwareIds(TENANT, false)).thenReturn(List.of("9"));
        List<SoftwareAutoUpdateStatus> statuses = List.of(SoftwareAutoUpdateStatus.NO_PACKAGE);
        SoftwareFilterInput filter = new SoftwareFilterInput();
        filter.setManageable(false);
        filter.setSources(List.of(SoftwareSource.UNMANAGED));
        filter.setOsTypes(List.of(OsType.MAC_OS));
        filter.setAutoUpdateStatuses(statuses);
        SoftwareTitleQuery expected = titles().manageable(false)
                .installerSources(Set.of()).unmanagedChosen(true)
                .osSources(Set.of("apps", "homebrew_packages", "safari_extensions", "pkg_packages"))
                .autoUpdateStatuses(statuses).enabledPolicyTitleIds(Set.of()).policyTitleIds(Set.of(9L)).build();

        // execution
        query.listSoftware(TENANT, null, 0, 10, null, null, filter);

        // verifications
        verify(softwareRepository).findTitles(eq(expected), any(Pageable.class));
    }

    @Test
    void listSoftware_nothingChosenInTheFilter_queryLeftOpenWithoutReadingPolicies() {
        // setup
        when(softwareRepository.findTitles(any(SoftwareTitleQuery.class), any(Pageable.class))).thenReturn(Page.empty());
        SoftwareFilterInput filter = new SoftwareFilterInput();
        filter.setSources(List.of());
        filter.setOsTypes(List.of());
        filter.setAutoUpdateStatuses(List.of());
        SoftwareTitleQuery expected = titles().build();

        // execution
        query.listSoftware(TENANT, null, 0, 10, null, null, filter);

        // verifications
        verify(softwareRepository).findTitles(eq(expected), any(Pageable.class));
        verifyNoInteractions(packageAutoUpdatePolicyRepository);
    }

    @Test
    void allForFilters_withAndWithoutSearch() {
        when(softwareRepository.findTitles(titles().build(), Pageable.unpaged()))
                .thenReturn(new PageImpl<>(List.of(software(1L, "apps", 1))));
        when(softwareRepository.findTitles(titles().nameLower("jq").build(), Pageable.unpaged()))
                .thenReturn(Page.empty());

        assertThat(query.allForFilters(TENANT, null)).extracting(SoftwareResponse::getType).containsExactly(SoftwareType.APPLICATION);
        assertThat(query.allForFilters(TENANT, "JQ")).isEmpty();
    }

    @Test
    void get_carriesTheProgramKeysAndTheStoredMatch() {
        SoftwarePackageMatch stored = new SoftwarePackageMatch(PackageMatchState.MATCHED, PackageManagerType.WINGET, "Google.Chrome", null);
        Software chrome = Software.builder().tenantId(TENANT).softwareTitleId(7L).name("Google Chrome").source("programs")
                .vendor("Google LLC").upgradeCode("{UPGRADE}").arpKeys(List.of("Google Chrome"))
                .packageFamilyNames(List.of("google.chrome_x")).systemComponent(false)
                .packageMatch(stored).build();
        when(softwareRepository.findByTenantIdAndSoftwareTitleId(TENANT, 7L)).thenReturn(Optional.of(chrome));

        SoftwareResponse row = query.get(TENANT, "7");

        assertThat(row.getFleetSource()).isEqualTo(FleetSource.PROGRAMS);
        assertThat(row.getPublisher()).isEqualTo("Google LLC");
        assertThat(row.getUpgradeCode()).isEqualTo("{UPGRADE}");
        assertThat(row.getProductCodes()).containsExactly("Google Chrome");
        assertThat(row.getPackageFamilyNames()).containsExactly("google.chrome_x");
        assertThat(row.getSystemComponent()).isFalse();
        assertThat(row.getPackageMatch()).isEqualTo(stored);
    }

    private static Stream<Arguments> sourcesAndTheirQuery() {
        return Stream.of(
                Arguments.of(List.of(SoftwareSource.WINGET), Set.of("winget_packages"), true, false),
                Arguments.of(List.of(SoftwareSource.BREW), Set.of("homebrew_packages"), false, false),
                Arguments.of(List.of(SoftwareSource.CHOCOLATEY), Set.of("chocolatey_packages"), false, false),
                Arguments.of(List.of(SoftwareSource.UNMANAGED), Set.of(), false, true),
                Arguments.of(List.of(SoftwareSource.WINGET, SoftwareSource.BREW, SoftwareSource.UNMANAGED),
                        Set.of("winget_packages", "homebrew_packages"), true, true));
    }

    private static Stream<Arguments> osTypesAndTheirSources() {
        Set<String> windows = Set.of("programs", "chocolatey_packages", "winget_packages", "ie_extensions");
        Set<String> macOs = Set.of("apps", "homebrew_packages", "safari_extensions", "pkg_packages");
        Set<String> both = Set.of("programs", "chocolatey_packages", "winget_packages", "ie_extensions",
                "apps", "homebrew_packages", "safari_extensions", "pkg_packages");
        return Stream.of(
                Arguments.of(List.of(OsType.WINDOWS), windows),
                Arguments.of(List.of(OsType.MAC_OS), macOs),
                Arguments.of(List.of(OsType.WINDOWS, OsType.MAC_OS), both));
    }
}
