package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareFilters;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceResponse;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.service.rmm.fleet.FleetClientProvider;
import com.openframe.api.service.rmm.fleet.FleetHostMachineResolver;
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
    @Mock private TenantIdProvider tenantIdProvider;

    private SoftwareInventoryService service;

    @BeforeEach
    void setUp() {
        service = new SoftwareInventoryService(fleet, hostMachineResolver, tenantIdProvider);
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

        SoftwareFilters filters = service.getSoftwareFilters(null);

        assertThat(filters.getSources()).isEmpty();
        assertThat(filters.getVersionStatuses()).isEmpty();
        assertThat(filters.getSeverities()).isEmpty();
    }

    private static Host host(long id, String uuid, String hostname) {
        Host h = new Host();
        h.setId(id);
        h.setUuid(uuid);
        h.setHostname(hostname);
        return h;
    }
}
