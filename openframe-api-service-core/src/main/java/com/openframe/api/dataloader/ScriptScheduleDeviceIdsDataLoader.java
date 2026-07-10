package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.api.service.rmm.ScriptScheduleDeviceService;
import lombok.RequiredArgsConstructor;
import org.dataloader.BatchLoader;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;

/**
 * Batch loads the assigned {@code machineId}s per script schedule, so the
 * {@code assignedDevices} and {@code deviceCount} fields do not trigger an N+1
 * over a list of schedules.
 *
 * <p>Resolved synchronously (not {@code supplyAsync}) so the tenant context
 * ({@code TenantIdProvider}) is read on the request thread rather than a pool thread.
 */
@DgsDataLoader(name = "scriptScheduleDeviceIdsDataLoader")
@RequiredArgsConstructor
public class ScriptScheduleDeviceIdsDataLoader implements BatchLoader<String, List<String>> {

    private final ScriptScheduleDeviceService scriptScheduleDeviceService;

    @Override
    public CompletionStage<List<List<String>>> load(List<String> scheduleIds) {
        Map<String, List<String>> bySchedule =
                scriptScheduleDeviceService.getMachineIdsByScheduleIds(scheduleIds);
        List<List<String>> ordered = scheduleIds.stream()
                .map(id -> bySchedule.getOrDefault(id, List.of()))
                .toList();
        return CompletableFuture.completedFuture(ordered);
    }
}
