package com.openframe.api.service.rmm.fleet;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.LoadingCache;
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
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.util.CollectionUtils.isEmpty;

@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class CorrelatedHostSoftwareCache {

    private static final int HOSTS_PAGE = 100;
    private static final Duration REFRESH = Duration.ofMinutes(2);
    private static final Duration EXPIRY = Duration.ofMinutes(30);
    private static final Executor BACKGROUND_RELOAD = task -> Thread.ofVirtual().start(task);

    private final FleetHostMachineResolver hostMachineResolver;
    private final TenantIdProvider tenantIdProvider;
    // every caller searches the same Fleet; the latest search serves the background reloads
    private final AtomicReference<Function<HostSearchRequest, List<Host>>> latestHostSearch = new AtomicReference<>();
    private final LoadingCache<String, Snapshot> byTenant = Caffeine.newBuilder()
            .refreshAfterWrite(REFRESH)
            .expireAfterWrite(EXPIRY)
            .executor(BACKGROUND_RELOAD)
            .build(this::load);

    public record Snapshot(Map<Long, Machine> machinesByHostId,
                           Map<Long, List<FleetSoftware>> softwareByHostId) {
    }

    public Snapshot snapshot(Function<HostSearchRequest, List<Host>> hostSearch) {
        latestHostSearch.set(hostSearch);
        String tenantId = tenantIdProvider.getTenantId();
        return byTenant.get(tenantId);
    }

    public Map<Long, List<FleetSoftware>> softwareByHostId(Function<HostSearchRequest, List<Host>> hostSearch) {
        return snapshot(hostSearch).softwareByHostId();
    }

    private Snapshot load(String tenantId) {
        List<Host> hosts = fetchHostsWithSoftware(latestHostSearch.get());
        Map<Long, Machine> correlated = hostMachineResolver.resolve(tenantId, hosts);
        Map<Long, List<FleetSoftware>> software = hosts.stream()
                .filter(host -> correlated.containsKey(host.getId()))
                .collect(Collectors.toMap(Host::getId, CorrelatedHostSoftwareCache::softwareOf));
        return new Snapshot(correlated, software);
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
        request.includeSoftware();
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
