package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.repository.organization.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import org.dataloader.BatchLoader;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.stream.Collectors;

/**
 * DataLoader for batch loading Organization objects by organizationId.
 * This prevents N+1 query problems when loading organizations for multiple machines.
 */
@DgsDataLoader(name = "organizationDataLoader")
@RequiredArgsConstructor
public class OrganizationDataLoader implements BatchLoader<String, Organization> {

    private final OrganizationRepository organizationRepository;

    @Override
    public CompletionStage<List<Organization>> load(List<String> organizationIds) {
        return CompletableFuture.supplyAsync(() -> {
            // Remove nulls and get unique IDs
            Set<String> nonNullIds = organizationIds.stream()
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());

            if (nonNullIds.isEmpty()) {
                return organizationIds.stream()
                        .map(id -> (Organization) null)
                        .collect(Collectors.toList());
            }

            // Batch load organizations (excluding soft deleted)
            List<Organization> organizations = organizationRepository.findByOrganizationIdIn(nonNullIds);
            Map<String, Organization> orgMap = organizations.stream()
                    .filter(org -> !org.isDeleted())
                    .collect(Collectors.toMap(Organization::getOrganizationId, org -> org));

            // Return in same order as input
            return organizationIds.stream()
                    .map(orgId -> orgId == null ? null : orgMap.get(orgId))
                    .collect(Collectors.toList());
        });
    }
}
