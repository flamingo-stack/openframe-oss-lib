package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceCounts;
import com.openframe.api.service.rmm.osupdate.OsUpdateQueryService;
import lombok.RequiredArgsConstructor;
import org.dataloader.BatchLoader;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;

// Both counts of every update of a page in one batch.
@DgsDataLoader(name = "osUpdateDeviceCountsDataLoader")
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class OsUpdateDeviceCountsDataLoader implements BatchLoader<String, OsUpdateDeviceCounts> {

    private final OsUpdateQueryService osUpdateQueryService;

    @Override
    public CompletionStage<List<OsUpdateDeviceCounts>> load(List<String> osUpdateIds) {
        Map<String, OsUpdateDeviceCounts> deviceCountsByOsUpdateId = osUpdateQueryService.countDevices(osUpdateIds);
        List<OsUpdateDeviceCounts> orderedDeviceCounts = osUpdateIds.stream()
                .map(osUpdateId -> deviceCountsByOsUpdateId.getOrDefault(osUpdateId, OsUpdateDeviceCounts.NONE))
                .toList();
        return CompletableFuture.completedFuture(orderedDeviceCounts);
    }
}
