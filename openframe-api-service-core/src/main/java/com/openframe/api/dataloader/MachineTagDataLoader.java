package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.api.dto.device.MachineTag;
import com.openframe.api.service.TagService;
import lombok.RequiredArgsConstructor;
import org.dataloader.BatchLoader;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;

// Machine.tagAssignments: one assignment and one tag query per device list.
@DgsDataLoader(name = MachineTagDataLoader.NAME)
@RequiredArgsConstructor
public class MachineTagDataLoader implements BatchLoader<String, List<MachineTag>> {

    public static final String NAME = "machineTagDataLoader";

    private final TagService tagService;

    @Override
    public CompletionStage<List<List<MachineTag>>> load(List<String> machineIds) {
        return CompletableFuture.supplyAsync(() -> tagService.getTagAssignmentsForMachines(machineIds));
    }
}
