package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.api.service.rmm.ScriptScheduleDeviceService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import lombok.RequiredArgsConstructor;
import org.dataloader.BatchLoader;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Batch loads the assigned {@link Machine}s per script schedule in ONE dispatch:
 * schedule id &rarr; assigned machineIds &rarr; Machine objects.
 */
@DgsDataLoader(name = "scriptScheduleDeviceMachinesDataLoader")
@RequiredArgsConstructor
public class ScriptScheduleDeviceMachinesDataLoader implements BatchLoader<String, List<Machine>> {

    private final ScriptScheduleDeviceService scriptScheduleDeviceService;
    private final MachineRepository machineRepository;

    @Override
    public CompletionStage<List<List<Machine>>> load(List<String> scheduleIds) {
        Map<String, List<String>> machineIdsBySchedule =
                scriptScheduleDeviceService.getMachineIdsByScheduleIds(scheduleIds);

        // One machine lookup over the union of every schedule's assigned ids.
        Set<String> allMachineIds = machineIdsBySchedule.values().stream()
                .flatMap(List::stream)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        Map<String, Machine> byMachineId = allMachineIds.isEmpty()
                ? Map.of()
                : machineRepository.findByMachineIdIn(allMachineIds).stream()
                        .collect(Collectors.toMap(Machine::getMachineId, Function.identity(), (a, b) -> a));

        List<List<Machine>> ordered = scheduleIds.stream()
                .map(scheduleId -> machineIdsBySchedule.getOrDefault(scheduleId, List.of()).stream()
                        .map(byMachineId::get)
                        .filter(Objects::nonNull)
                        .toList())
                .toList();
        return CompletableFuture.completedFuture(ordered);
    }
}
