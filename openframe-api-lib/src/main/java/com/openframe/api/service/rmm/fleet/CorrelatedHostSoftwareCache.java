package com.openframe.api.service.rmm.fleet;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.openframe.data.document.device.Machine;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.model.FleetSoftware;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostSearchRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.util.CollectionUtils.isEmpty;

@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class CorrelatedHostSoftwareCache {

    private static final int HOSTS_PAGE = 100;
    private static final Duration TTL = Duration.ofMinutes(2);

    private final FleetHostMachineResolver hostMachineResolver;
    private final TenantIdProvider tenantIdProvider;
    private final Cache<String, Map<Long, List<FleetSoftware>>> softwareByTenant = Caffeine.newBuilder()
            .expireAfterWrite(TTL)
            .build();

    public Map<Long, List<FleetSoftware>> softwareByHostId(Function<HostSearchRequest, List<Host>> hostSearch) {
        String tenantId = tenantIdProvider.getTenantId();
        return softwareByTenant.get(tenantId, key -> loadCorrelatedSoftware(key, hostSearch));
    }

    private Map<Long, List<FleetSoftware>> loadCorrelatedSoftware(String tenantId,
                                                                  Function<HostSearchRequest, List<Host>> hostSearch) {
        List<Host> hosts = fetchHostsWithSoftware(hostSearch);
        Map<Long, Machine> correlated = hostMachineResolver.resolve(tenantId, hosts);
        return hosts.stream()
                .filter(host -> isCorrelated(host, correlated))
                .collect(Collectors.toMap(Host::getId, CorrelatedHostSoftwareCache::softwareOf));
    }

    private static boolean isCorrelated(Host host, Map<Long, Machine> correlated) {
        Long hostId = host.getId();
        return correlated.containsKey(hostId);
    }

    private static List<Host> fetchHostsWithSoftware(Function<HostSearchRequest, List<Host>> hostSearch) {
        Map<Long, Host> byId = new LinkedHashMap<>();
        int page = 0;
        List<Host> batch;
        do {
            HostSearchRequest request = hostsWithSoftwarePage(page);
            batch = hostSearch.apply(request);
            batch.stream()
                    .filter(CorrelatedHostSoftwareCache::hasId)
                    .forEach(host -> addOnce(byId, host));
            page++;
        } while (isFullPage(batch));
        return new ArrayList<>(byId.values());
    }

    private static HostSearchRequest hostsWithSoftwarePage(int page) {
        HostSearchRequest request = new HostSearchRequest();
        request.setPage(page);
        request.setPerPage(HOSTS_PAGE);
        request.setPopulateSoftware(true);
        return request;
    }

    private static boolean hasId(Host host) {
        return host.getId() != null;
    }

    private static void addOnce(Map<Long, Host> byId, Host host) {
        Long hostId = host.getId();
        byId.putIfAbsent(hostId, host);
    }

    private static boolean isFullPage(List<Host> batch) {
        return batch.size() == HOSTS_PAGE;
    }

    private static List<FleetSoftware> softwareOf(Host host) {
        List<FleetSoftware> software = host.getSoftware();
        return isEmpty(software) ? List.of() : software;
    }
}
