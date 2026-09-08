package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.api.service.rmm.schedule.ScheduleScriptDeviceService;
import lombok.RequiredArgsConstructor;
import org.dataloader.BatchLoader;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;

@DgsDataLoader(name = "scriptScheduleDeviceCountDataLoader")
@RequiredArgsConstructor
public class ScriptScheduleDeviceCountDataLoader implements BatchLoader<String, Integer> {

    private final ScheduleScriptDeviceService scheduleScriptDeviceService;

    @Override
    public CompletionStage<List<Integer>> load(List<String> scheduleIds) {
        Map<String, Integer> countsBySchedule =
                scheduleScriptDeviceService.getMachineCountsByScheduleIds(scheduleIds);
        List<Integer> ordered = scheduleIds.stream()
                .map(id -> countsBySchedule.getOrDefault(id, 0))
                .toList();
        return CompletableFuture.completedFuture(ordered);
    }
}
