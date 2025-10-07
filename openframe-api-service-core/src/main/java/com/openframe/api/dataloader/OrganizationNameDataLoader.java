package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.data.service.OrganizationService;
import lombok.RequiredArgsConstructor;
import org.dataloader.BatchLoader;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;

/**
 * DataLoader for batch loading organization names by organizationId.
 * This prevents N+1 query problems when loading organization names for multiple machines.
 */
@DgsDataLoader(name = "organizationNameDataLoader")
@RequiredArgsConstructor
public class OrganizationNameDataLoader implements BatchLoader<String, String> {

    private final OrganizationService organizationService;

    @Override
    public CompletionStage<List<String>> load(List<String> organizationIds) {
        return CompletableFuture.supplyAsync(() -> 
            organizationService.getOrganizationNamesForOrganizationIds(organizationIds)
        );
    }
}
