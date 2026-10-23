package com.openframe.api.service.rmm.fleet;

import com.openframe.data.document.device.Machine;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.model.FleetSoftware;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostSearchRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiConsumer;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static org.springframework.util.CollectionUtils.isEmpty;

@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class FleetDeviceCountEnricher {

    private final FleetHostMachineResolver hostMachineResolver;
    private final TenantIdProvider tenantIdProvider;
    private final CorrelatedHostSoftwareCache hostSoftwareCache;

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

    // enrich() makes one Fleet call per row, which times out over whole lists of titles or CVEs.
    public <T, K> void enrichFromHostSoftware(List<T> rows,
                                              Function<HostSearchRequest, List<Host>> hostSearch,
                                              Function<FleetSoftware, Stream<K>> keysOf,
                                              Function<T, K> rowKey,
                                              BiConsumer<T, Integer> countSetter) {
        if (isEmpty(rows)) {
            return;
        }
        Map<Long, List<FleetSoftware>> softwareByHostId = hostSoftwareCache.softwareByHostId(hostSearch);
        Collection<List<FleetSoftware>> softwarePerHost = softwareByHostId.values();
        Map<K, Long> hostsPerKey = countHostsPerKey(softwarePerHost, keysOf);
        rows.forEach(row -> assignCount(row, hostsPerKey, rowKey, countSetter));
    }

    private static <K> Map<K, Long> countHostsPerKey(Collection<List<FleetSoftware>> softwarePerHost,
                                                     Function<FleetSoftware, Stream<K>> keysOf) {
        return softwarePerHost.stream()
                .flatMap(software -> distinctKeys(software, keysOf))
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
    }

    private static <K> Stream<K> distinctKeys(List<FleetSoftware> software, Function<FleetSoftware, Stream<K>> keysOf) {
        return software.stream()
                .flatMap(keysOf)
                .filter(Objects::nonNull)
                .distinct();
    }

    private static <T, K> void assignCount(T row, Map<K, Long> hostsPerKey,
                                           Function<T, K> rowKey, BiConsumer<T, Integer> countSetter) {
        K key = rowKey.apply(row);
        Long hosts = hostsPerKey.getOrDefault(key, 0L);
        int count = hosts.intValue();
        countSetter.accept(row, count);
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
