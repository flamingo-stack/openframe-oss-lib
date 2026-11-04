package com.openframe.api.service.rmm.software;

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
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.software.DeviceVulnerability;
import com.openframe.data.document.rmm.software.Software;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.software.DeviceVulnerabilityRepository;
import com.openframe.data.repository.rmm.software.SoftwareRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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

    @Mock private SoftwareRepository softwareRepository;
    @Mock private DeviceVulnerabilityRepository vulnerabilityRepository;
    @Mock private MachineRepository machineRepository;

    @InjectMocks private TenantSoftwareReadModelQuery query;

    private static Software.Installation installation(String machineId, String... versions) {
        return Software.Installation.builder().machineId(machineId).versions(List.of(versions)).build();
    }

    private static Software software(long titleId, String source, Software.Installation... installations) {
        return Software.builder()
                .tenantId(TENANT).softwareTitleId(titleId).name("jq").source(source)
                .latestVersion("1.7").devicesCount(installations.length).cveCount(2)
                .installations(List.of(installations))
                .build();
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
    void get_mapsTheTitleLikeTheFleetPath() {
        Software.Installation onM1 = installation("m1", "1.6");
        Software.Installation onM2 = installation("m2", "1.7");
        Software.Installation onM3 = installation("m3", "1.7");
        Software jq = software(42L, "homebrew_packages", onM1, onM2, onM3);
        when(softwareRepository.findByTenantIdAndSoftwareTitleId(TENANT, 42L)).thenReturn(Optional.of(jq));

        SoftwareResponse row = query.get(TENANT, "42");

        assertThat(row.getId()).isEqualTo("42");
        assertThat(row.getSource()).isEqualTo(SoftwareSource.BREW);
        assertThat(row.getType()).isEqualTo(SoftwareType.PACKAGE);
        assertThat(row.getCurrentVersion()).isEqualTo("1.7");          // the version on the most devices
        assertThat(row.getOlderVersionsCount()).isEqualTo(1);           // 1.6 besides it
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
    void listSoftware_searchAndVulnerable_pickTheMatchingQuery_sortedAndPaged() {
        Software one = software(1L, "apps", installation("m1", "1.0"));
        Page<Software> page = new PageImpl<>(List.of(one), PageRequest.of(1, 1), 3);
        when(softwareRepository.findByTenantIdAndNameLowerContainingAndCveCountGreaterThanAndDevicesCountGreaterThan(
                eq(TENANT), eq("jq"), eq(0), eq(0), any(Pageable.class))).thenReturn(page);
        SortInput sort = new SortInput();
        sort.setField("devicesCount");
        sort.setDirection(SortDirection.DESC);

        PageResult<SoftwareResponse> result = query.listSoftware(TENANT, "JQ", 1, 1, sort, true);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(softwareRepository).findByTenantIdAndNameLowerContainingAndCveCountGreaterThanAndDevicesCountGreaterThan(
                eq(TENANT), eq("jq"), eq(0), eq(0), pageable.capture());
        assertThat(pageable.getValue().getSort()).isEqualTo(Sort.by(Sort.Direction.DESC, "devicesCount"));
        assertThat(pageable.getValue().getPageSize()).isEqualTo(1);
        assertThat(result.items()).extracting(SoftwareResponse::getId).containsExactly("1");
        assertThat(result.filteredCount()).isEqualTo(3);
        assertThat(result.hasNext()).isTrue();
        assertThat(result.hasPrevious()).isTrue();
    }

    @Test
    void listSoftware_noSearchNoFlag_allWithDevices_byNameAscending() {
        when(softwareRepository.findByTenantIdAndDevicesCountGreaterThan(eq(TENANT), eq(0), any(Pageable.class)))
                .thenReturn(Page.empty());

        query.listSoftware(TENANT, null, 0, null, null, null);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(softwareRepository).findByTenantIdAndDevicesCountGreaterThan(eq(TENANT), eq(0), pageable.capture());
        assertThat(pageable.getValue().getSort()).isEqualTo(Sort.by(Sort.Direction.ASC, "nameLower"));
        assertThat(pageable.getValue().getPageSize()).isEqualTo(20);
    }

    @Test
    void listSoftware_searchOnly_and_vulnerableOnly_useTheirOwnQueries() {
        when(softwareRepository.findByTenantIdAndNameLowerContainingAndDevicesCountGreaterThan(
                eq(TENANT), eq("jq"), eq(0), any(Pageable.class))).thenReturn(Page.empty());
        when(softwareRepository.findByTenantIdAndCveCountGreaterThanAndDevicesCountGreaterThan(
                eq(TENANT), eq(0), eq(0), any(Pageable.class))).thenReturn(Page.empty());

        query.listSoftware(TENANT, "jq", 0, 10, null, false);
        query.listSoftware(TENANT, " ", 0, 10, null, true);

        verify(softwareRepository).findByTenantIdAndNameLowerContainingAndDevicesCountGreaterThan(
                eq(TENANT), eq("jq"), eq(0), any(Pageable.class));
        verify(softwareRepository).findByTenantIdAndCveCountGreaterThanAndDevicesCountGreaterThan(
                eq(TENANT), eq(0), eq(0), any(Pageable.class));
    }

    @Test
    void devicesForSoftwareRows_statusAgainstTheGivenLatest_allVersionsMustReachIt() {
        Software.Installation latest = installation("m1", "10.0");
        Software.Installation older = installation("m2", "9.0");
        Software.Installation both = installation("m3", "10.0", "9.0");
        Software.Installation onAGoneMachine = installation("gone", "10.0");
        Software app = software(42L, "apps", latest, older, both, onAGoneMachine);
        when(softwareRepository.findByTenantIdAndSoftwareTitleId(TENANT, 42L)).thenReturn(Optional.of(app));
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
    void devicesForSoftwareRows_searchByHostname_noLatestMeansOutdated() {
        when(softwareRepository.findByTenantIdAndSoftwareTitleId(TENANT, 42L)).thenReturn(Optional.of(software(42L, "apps",
                installation("m1", "1.0"), installation("m2", "1.0"))));
        when(machineRepository.findByMachineIdIn(anyList())).thenReturn(List.of(
                machine("m1", "Alpha-laptop"), machine("m2", "beta")));

        List<SoftwareOnDeviceResponse> rows = query.devicesForSoftwareRows(TENANT, "42", "ALPHA", null);

        assertThat(rows).extracting(row -> row.getDevice().getMachineId()).containsExactly("m1");
        assertThat(rows.getFirst().getStatus()).isEqualTo(SoftwareOnDeviceStatus.OUTDATED);
    }

    @Test
    void listVulnerabilitiesForSoftware_searchSortAndAffectedVersion() {
        DeviceVulnerability older = DeviceVulnerability.builder().cveId("CVE-2024-1").discoveredAt(Instant.parse("2024-01-01T00:00:00Z"))
                .affectedSoftware(List.of(DeviceVulnerability.AffectedSoftware.builder().softwareTitleId(99L).installedVersion("x").build(),
                        DeviceVulnerability.AffectedSoftware.builder().softwareTitleId(42L).installedVersion("1.6").build()))
                .build();
        DeviceVulnerability newer = DeviceVulnerability.builder().cveId("CVE-2025-2").discoveredAt(Instant.parse("2025-01-01T00:00:00Z"))
                .build();
        DeviceVulnerability other = DeviceVulnerability.builder().cveId("GHSA-1").build();
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

    @Test
    void allForFilters_withAndWithoutSearch() {
        when(softwareRepository.findByTenantIdAndDevicesCountGreaterThan(TENANT, 0, Pageable.unpaged()))
                .thenReturn(new PageImpl<>(List.of(software(1L, "apps", installation("m1", "1.0")))));
        when(softwareRepository.findByTenantIdAndNameLowerContainingAndDevicesCountGreaterThan(TENANT, "jq", 0, Pageable.unpaged()))
                .thenReturn(Page.empty());

        assertThat(query.allForFilters(TENANT, null)).extracting(SoftwareResponse::getType).containsExactly(SoftwareType.APPLICATION);
        assertThat(query.allForFilters(TENANT, "JQ")).isEmpty();
    }
}
