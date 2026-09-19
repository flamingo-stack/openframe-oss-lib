package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareFilters;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceResponse;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.core.exception.BadRequestException;
import com.openframe.api.service.rmm.fleet.FleetClientProvider;
import com.openframe.api.service.rmm.fleet.FleetHostMachineResolver;
import com.openframe.api.service.rmm.fleet.FleetTenantTeamResolver;
import com.openframe.data.document.device.Machine;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.SoftwareTitle;
import com.openframe.sdk.fleetmdm.model.SoftwareTitleVersion;
import com.openframe.sdk.fleetmdm.model.SoftwareTitlesResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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

    @Mock private FleetClientProvider fleet;
    @Mock private FleetHostMachineResolver hostMachineResolver;
    @Mock private FleetTenantTeamResolver teamResolver;
    @Mock private TenantIdProvider tenantIdProvider;

    private SoftwareInventoryService service;

    @BeforeEach
    void setUp() {
        service = new SoftwareInventoryService(fleet, hostMachineResolver, teamResolver, tenantIdProvider);
    }

    @Test
    @DisplayName("listDevicesForSoftware: a non-numeric id short-circuits to empty without touching Fleet")
    void listDevices_nonNumericId_emptyNoFleet() {
        assertThat(service.listDevicesForSoftware("not-a-number", null, 0, 50).items()).isEmpty();
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
        Host foreign = host(2L, "u2", "host-2");   // no matching Machine → dropped

        // call 1 = getSoftwareTitle, call 2 = searchHosts(software_version_id=10)
        when(fleet.call(any(), any())).thenReturn(title, List.of(enrolled, foreign));
        when(tenantIdProvider.getTenantId()).thenReturn("t1");
        Machine machine = new Machine();
        machine.setMachineId("m-1");
        machine.setHostname("host-1");
        when(hostMachineResolver.resolve(eq("t1"), anyList())).thenReturn(Map.of(1L, machine));

        PageResult<SoftwareOnDeviceResponse> result = service.listDevicesForSoftware("42", null, 0, 50);

        assertThat(result.items()).hasSize(1);
        SoftwareOnDeviceResponse row = result.items().get(0);
        assertThat(row.getDevice().getMachineId()).isEqualTo("m-1");
        assertThat(row.getSoftwareVersion()).isEqualTo("1.2.3");
        assertThat(row.getStatus()).isNotNull();
    }

    @Test
    @DisplayName("getSoftwareFilters: no titles → valid empty facet lists (never null)")
    void getSoftwareFilters_noTitles_emptyFacets() {
        SoftwareTitlesResponse response = mock(SoftwareTitlesResponse.class);
        when(response.getSoftwareTitles()).thenReturn(List.of());
        when(fleet.call(any(), any())).thenReturn(response);
        when(teamResolver.currentTenantTeamId()).thenReturn(java.util.Optional.empty());

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
        when(fleet.call(any(), any())).thenReturn(response); // meta null → single page in the scan
        when(teamResolver.currentTenantTeamId()).thenReturn(java.util.Optional.empty());

        PageResult<SoftwareResponse> result = service.listSoftware("", 0, 20, sort("cveCount", SortDirection.DESC), null);

        assertThat(result.items()).extracting(SoftwareResponse::getName)
                .containsExactly("Chrome", "Alpha", "Bravo"); // 40 first; the two 5s by name ascending
    }

    @Test
    @DisplayName("listSoftware: an unknown sort field is a client error (BadRequest), not a Fleet call")
    void listSoftware_unknownSortField_throwsBadRequest() {
        when(teamResolver.currentTenantTeamId()).thenReturn(java.util.Optional.empty());

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
