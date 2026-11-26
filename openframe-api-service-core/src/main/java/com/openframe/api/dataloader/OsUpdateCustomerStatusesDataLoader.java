package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceScope;
import com.openframe.api.service.rmm.osupdate.OsUpdateService;
import com.openframe.data.document.rmm.osupdate.OsUpdateCustomerStatus;
import lombok.RequiredArgsConstructor;
import org.dataloader.BatchLoader;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.stream.Collectors;

// The customer statuses of every update of a page in one batch per device scope. The key is the one of the device
// counts: an update within the device scope of its list.
@DgsDataLoader(name = "osUpdateCustomerStatusesDataLoader")
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class OsUpdateCustomerStatusesDataLoader
        implements BatchLoader<OsUpdateDeviceCountsKey, List<OsUpdateCustomerStatus>> {

    private final OsUpdateService osUpdateService;

    @Override
    public CompletionStage<List<List<OsUpdateCustomerStatus>>> load(
            List<OsUpdateDeviceCountsKey> osUpdateDeviceCountsKeys) {
        Map<OsUpdateDeviceScope, List<String>> osUpdateIdsByDeviceScope = osUpdateDeviceCountsKeys.stream()
                .collect(Collectors.groupingBy(OsUpdateDeviceCountsKey::getOsUpdateDeviceScope, LinkedHashMap::new,
                        Collectors.mapping(OsUpdateDeviceCountsKey::getOsUpdateId, Collectors.toList())));
        Map<OsUpdateDeviceCountsKey, List<OsUpdateCustomerStatus>> customerStatusesByKey = new HashMap<>();
        for (Map.Entry<OsUpdateDeviceScope, List<String>> osUpdateIdsOfDeviceScope
                : osUpdateIdsByDeviceScope.entrySet()) {
            OsUpdateDeviceScope osUpdateDeviceScope = osUpdateIdsOfDeviceScope.getKey();
            Map<String, List<OsUpdateCustomerStatus>> customerStatusesByOsUpdateId =
                    osUpdateService.findCustomerStatuses(osUpdateIdsOfDeviceScope.getValue(), osUpdateDeviceScope);
            for (String osUpdateId : osUpdateIdsOfDeviceScope.getValue()) {
                OsUpdateDeviceCountsKey osUpdateDeviceCountsKey = OsUpdateDeviceCountsKey.builder()
                        .osUpdateId(osUpdateId)
                        .osUpdateDeviceScope(osUpdateDeviceScope)
                        .build();
                customerStatusesByKey.put(osUpdateDeviceCountsKey,
                        customerStatusesByOsUpdateId.getOrDefault(osUpdateId, List.of()));
            }
        }
        List<List<OsUpdateCustomerStatus>> orderedCustomerStatuses = osUpdateDeviceCountsKeys.stream()
                .map(customerStatusesByKey::get)
                .toList();
        return CompletableFuture.completedFuture(orderedCustomerStatuses);
    }
}
