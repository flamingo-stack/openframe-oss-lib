package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceCounts;
import com.openframe.api.service.rmm.osupdate.OsUpdateQueryService;
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

// Both counts of every update of a page in one batch per organization scope.
@DgsDataLoader(name = "osUpdateDeviceCountsDataLoader")
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class OsUpdateDeviceCountsDataLoader implements BatchLoader<OsUpdateDeviceCountsKey, OsUpdateDeviceCounts> {

    private final OsUpdateQueryService osUpdateQueryService;

    @Override
    public CompletionStage<List<OsUpdateDeviceCounts>> load(List<OsUpdateDeviceCountsKey> osUpdateDeviceCountsKeys) {
        Map<List<String>, List<String>> osUpdateIdsByOrganizationIds = osUpdateDeviceCountsKeys.stream()
                .collect(Collectors.groupingBy(OsUpdateDeviceCountsKey::getOrganizationIds, LinkedHashMap::new,
                        Collectors.mapping(OsUpdateDeviceCountsKey::getOsUpdateId, Collectors.toList())));
        Map<OsUpdateDeviceCountsKey, OsUpdateDeviceCounts> deviceCountsByKey = new HashMap<>();
        osUpdateIdsByOrganizationIds.forEach((organizationIds, osUpdateIds) -> {
            Map<String, OsUpdateDeviceCounts> deviceCountsByOsUpdateId =
                    osUpdateQueryService.countDevices(osUpdateIds, organizationIds);
            osUpdateIds.forEach(osUpdateId -> deviceCountsByKey.put(
                    OsUpdateDeviceCountsKey.builder().osUpdateId(osUpdateId).organizationIds(organizationIds).build(),
                    deviceCountsByOsUpdateId.getOrDefault(osUpdateId, OsUpdateDeviceCounts.NONE)));
        });
        List<OsUpdateDeviceCounts> orderedDeviceCounts = osUpdateDeviceCountsKeys.stream()
                .map(deviceCountsByKey::get)
                .toList();
        return CompletableFuture.completedFuture(orderedDeviceCounts);
    }
}
