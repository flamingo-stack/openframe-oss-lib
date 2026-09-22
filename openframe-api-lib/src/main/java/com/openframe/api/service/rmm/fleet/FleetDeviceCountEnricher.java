package com.openframe.api.service.rmm.fleet;

import com.openframe.data.document.device.Machine;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.model.Host;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiConsumer;
import java.util.function.Function;
import java.util.stream.IntStream;

@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class FleetDeviceCountEnricher {

    private final FleetHostMachineResolver hostMachineResolver;
    private final TenantIdProvider tenantIdProvider;

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
