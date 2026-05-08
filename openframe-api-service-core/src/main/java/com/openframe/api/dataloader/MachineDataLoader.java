package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import lombok.RequiredArgsConstructor;
import org.dataloader.BatchLoader;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.stream.Collectors;

/**
 * DataLoader for batch loading Machine objects by machineId.
 * Used by AssignableTarget polymorphic resolution for DEVICE target type.
 */
@DgsDataLoader(name = "machineDataLoader")
@RequiredArgsConstructor
public class MachineDataLoader implements BatchLoader<String, Machine> {

    private final MachineRepository machineRepository;

    @Override
    public CompletionStage<List<Machine>> load(List<String> machineIds) {
        return CompletableFuture.supplyAsync(() -> {
            Set<String> nonNullIds = machineIds.stream()
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());

            if (nonNullIds.isEmpty()) {
                return machineIds.stream()
                        .map(id -> (Machine) null)
                        .collect(Collectors.toList());
            }

            List<Machine> machines = machineRepository.findByMachineIdIn(nonNullIds);
            Map<String, Machine> machineMap = machines.stream()
                    .collect(Collectors.toMap(Machine::getMachineId, m -> m));

            return machineIds.stream()
                    .map(id -> id == null ? null : machineMap.get(id))
                    .collect(Collectors.toList());
        });
    }
}
