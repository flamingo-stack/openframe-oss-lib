package com.openframe.api.service.rmm.fleet;

import com.openframe.data.document.device.Machine;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.model.FleetSoftware;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostSearchRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiConsumer;
import java.util.function.Function;
import java.util.stream.IntStream;
import java.util.stream.Stream;

@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class FleetDeviceCountEnricher {

    private static final int HOSTS_PAGE = 100;
    private static final Duration SNAPSHOT_TTL = Duration.ofMinutes(2);

    private final FleetHostMachineResolver hostMachineResolver;
    private final TenantIdProvider tenantIdProvider;
    private final Map<String, SoftwareSnapshot> snapshots = new ConcurrentHashMap<>();

    public <T> void enrich(List<T> rows,
                           Function<T, List<Host>> hostFetcher,
                           BiConsumer<T, Integer> countSetter) {
        if (rows == null || rows.isEmpty()) {
            return;
        }
        Map<Integer, List<Host>> hostsByRow = fanOut(rows, hostFetcher);
        Map<Long, Machine> correlated = batchCorrelate(hostsByRow);
        assignCounts(rows, hostsByRow, correlated, countSetter);
    }

    // Whole lists must count through here: enrich() does one Fleet call per row, and over thousands of
    // titles/CVEs that times the request out.
    public <T, K> void enrichFromHostSoftware(List<T> rows,
                                              Function<HostSearchRequest, List<Host>> hostSearch,
                                              Function<FleetSoftware, Stream<K>> keysOf,
                                              Function<T, K> rowKey,
                                              BiConsumer<T, Integer> countSetter) {
        if (rows == null || rows.isEmpty()) {
            return;
        }
        Map<K, Integer> counts = new HashMap<>();
        correlatedSoftware(hostSearch).values()
                .forEach(software -> software.stream()
                        .flatMap(keysOf)
                        .filter(Objects::nonNull)
                        .distinct()
                        .forEach(key -> counts.merge(key, 1, Integer::sum)));
        rows.forEach(row -> countSetter.accept(row, counts.getOrDefault(rowKey.apply(row), 0)));
    }

    // One Fleet fetch is ~6 MB and seconds long; without the snapshot every page flip or sort pays it.
    private Map<Long, List<FleetSoftware>> correlatedSoftware(Function<HostSearchRequest, List<Host>> hostSearch) {
        String tenantId = tenantIdProvider.getTenantId();
        return snapshots.compute(tenantId, (key, current) -> current != null && current.isFresh()
                ? current
                : new SoftwareSnapshot(loadCorrelatedSoftware(tenantId, hostSearch), Instant.now())).softwareByHostId();
    }

    private Map<Long, List<FleetSoftware>> loadCorrelatedSoftware(String tenantId,
                                                                  Function<HostSearchRequest, List<Host>> hostSearch) {
        List<Host> hosts = fetchHostsWithSoftware(hostSearch);
        Map<Long, Machine> correlated = hostMachineResolver.resolve(tenantId, hosts);
        Map<Long, List<FleetSoftware>> softwareByHostId = new HashMap<>();
        hosts.stream()
                .filter(host -> correlated.containsKey(host.getId()))
                .forEach(host -> softwareByHostId.put(host.getId(), softwareOf(host)));
        return softwareByHostId;
    }

    private record SoftwareSnapshot(Map<Long, List<FleetSoftware>> softwareByHostId, Instant loadedAt) {

        boolean isFresh() {
            return loadedAt.plus(SNAPSHOT_TTL).isAfter(Instant.now());
        }
    }

    private static List<Host> fetchHostsWithSoftware(Function<HostSearchRequest, List<Host>> hostSearch) {
        Map<Long, Host> byId = new LinkedHashMap<>();
        int page = 0;
        while (true) {
            HostSearchRequest request = new HostSearchRequest();
            request.setPage(page);
            request.setPerPage(HOSTS_PAGE);
            request.setPopulateSoftware(true);
            List<Host> batch = hostSearch.apply(request);
            batch.stream()
                    .filter(host -> host.getId() != null)
                    .forEach(host -> byId.putIfAbsent(host.getId(), host));
            if (batch.size() < HOSTS_PAGE) {
                return new ArrayList<>(byId.values());
            }
            page++;
        }
    }

    private static List<FleetSoftware> softwareOf(Host host) {
        return host.getSoftware() == null ? List.of() : host.getSoftware();
    }

    private static <T> Map<Integer, List<Host>> fanOut(List<T> rows, Function<T, List<Host>> hostFetcher) {
        Map<Integer, List<Host>> byIndex = new ConcurrentHashMap<>(rows.size());
        IntStream.range(0, rows.size()).parallel().forEach(i ->
                byIndex.put(i, hostFetcher.apply(rows.get(i))));
        return byIndex;
    }

    private Map<Long, Machine> batchCorrelate(Map<Integer, List<Host>> hostsByRow) {
        List<Host> allHosts = hostsByRow.values().stream()
                .flatMap(List::stream)
                .toList();
        return hostMachineResolver.resolve(tenantIdProvider.getTenantId(), allHosts);
    }

    private static <T> void assignCounts(List<T> rows,
                                         Map<Integer, List<Host>> hostsByRow,
                                         Map<Long, Machine> correlated,
                                         BiConsumer<T, Integer> countSetter) {
        for (int i = 0; i < rows.size(); i++) {
            int count = (int) hostsByRow.getOrDefault(i, List.of()).stream()
                    .filter(h -> h.getId() != null && correlated.containsKey(h.getId()))
                    .count();
            countSetter.accept(rows.get(i), count);
        }
    }
}
