package com.openframe.api.service.rmm.fleet;

import com.openframe.data.document.device.Machine;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.model.FleetSoftware;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostSearchRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.LongStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CorrelatedHostSoftwareCacheTest {

    @Mock private FleetHostMachineResolver hostMachineResolver;
    @Mock private TenantIdProvider tenantIdProvider;

    private CorrelatedHostSoftwareCache cache;

    @BeforeEach
    void setUp() {
        cache = new CorrelatedHostSoftwareCache(hostMachineResolver, tenantIdProvider);
        when(tenantIdProvider.getTenantId()).thenReturn("t1");
    }

    @Test
    void softwareByHostId_keepsOnlyHostsCorrelatedToAMachine() {
        Host enrolled = hostWith(1L, "chrome");
        Host orphan = hostWith(2L, "slack");
        when(hostMachineResolver.resolve(eq("t1"), anyList())).thenReturn(Map.of(1L, new Machine()));

        Map<Long, List<FleetSoftware>> softwareByHostId = cache.softwareByHostId(request -> List.of(enrolled, orphan));

        assertThat(softwareByHostId).containsOnlyKeys(1L);
        assertThat(softwareByHostId.get(1L)).extracting(FleetSoftware::getName).containsExactly("chrome");
    }

    @Test
    void softwareByHostId_pagesHostsWithSoftwareUntilAShortPage() {
        List<HostSearchRequest> requests = new ArrayList<>();
        List<Host> fullPage = LongStream.range(0, 100).mapToObj(id -> hostWith(id, "a")).toList();
        List<Host> lastPage = List.of(hostWith(100L, "a"));
        when(hostMachineResolver.resolve(eq("t1"), anyList())).thenReturn(Map.of());

        cache.softwareByHostId(request -> {
            requests.add(request);
            return request.getPage() == 0 ? fullPage : lastPage;
        });

        assertThat(requests).extracting(HostSearchRequest::getPage).containsExactly(0, 1);
        assertThat(requests).allMatch(HostSearchRequest::isPopulateSoftware);
    }

    @Test
    void softwareByHostId_loadsOncePerTenantWithinTtl() {
        List<HostSearchRequest> requests = new ArrayList<>();
        when(hostMachineResolver.resolve(eq("t1"), anyList())).thenReturn(Map.of(1L, new Machine()));

        cache.softwareByHostId(request -> { requests.add(request); return List.of(hostWith(1L, "a")); });
        Map<Long, List<FleetSoftware>> cached = cache.softwareByHostId(request -> { requests.add(request); return List.of(); });

        assertThat(requests).hasSize(1);
        assertThat(cached).containsOnlyKeys(1L);
        verify(hostMachineResolver, times(1)).resolve(eq("t1"), anyList());
    }

    @Test
    void softwareByHostId_hostWithoutSoftware_mapsToEmptyList() {
        Host bare = new Host();
        bare.setId(1L);
        when(hostMachineResolver.resolve(eq("t1"), anyList())).thenReturn(Map.of(1L, new Machine()));

        Map<Long, List<FleetSoftware>> softwareByHostId = cache.softwareByHostId(request -> List.of(bare));

        assertThat(softwareByHostId.get(1L)).isEmpty();
    }

    private static Host hostWith(long id, String... softwareNames) {
        Host host = new Host();
        host.setId(id);
        host.setSoftware(java.util.Arrays.stream(softwareNames).map(CorrelatedHostSoftwareCacheTest::installed).toList());
        return host;
    }

    private static FleetSoftware installed(String name) {
        FleetSoftware software = new FleetSoftware();
        software.setName(name);
        return software;
    }
}
