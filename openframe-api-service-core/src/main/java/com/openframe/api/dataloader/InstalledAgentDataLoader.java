package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.api.service.InstalledAgentService;
import com.openframe.data.document.installedagents.InstalledAgent;
import lombok.RequiredArgsConstructor;
import org.dataloader.BatchLoader;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;

@DgsDataLoader(name = "installedAgentDataLoader")
@RequiredArgsConstructor
public class InstalledAgentDataLoader implements BatchLoader<String, List<InstalledAgent>> {

    private final InstalledAgentService installedAgentService;

    @Override
    public CompletionStage<List<List<InstalledAgent>>> load(List<String> machineIds) {
        return CompletableFuture.supplyAsync(() -> installedAgentService.getInstalledAgentsForMachines(machineIds));
    }
}

