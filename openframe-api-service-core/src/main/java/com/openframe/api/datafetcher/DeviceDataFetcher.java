package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dataloader.OrganizationDataLoader;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.device.DeviceFilterInput;
import com.openframe.api.dto.device.DeviceFilterFacet;
import com.openframe.api.dto.device.DeviceFilters;
import com.openframe.api.dto.device.MachinePackageManagersResponse;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLDeviceMapper;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.api.service.device.DeviceFilterService;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.FleetVulnerabilityStatusService;
import com.openframe.api.service.TagService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.installedagents.InstalledAgent;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.OrganizationStatus;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import graphql.schema.DataFetchingFieldSelectionSet;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dataloader.DataLoader;
import org.springframework.validation.annotation.Validated;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

import static com.openframe.graphql.relay.NodeType.MACHINE;

@DgsComponent
@Slf4j
@Validated
@RequiredArgsConstructor
public class DeviceDataFetcher {

    private final DeviceService deviceService;
    private final DeviceFilterService deviceFilterService;
    private final TagService tagService;
    private final FleetVulnerabilityStatusService fleetVulnerabilityStatusService;
    private final GraphQLDeviceMapper mapper;
    private final PackageManagerAvailability packageManagerAvailability;
    private final RelayIdCodec relayIdCodec;

    @DgsQuery
    public CompletableFuture<DeviceFilters> deviceFilters(@InputArgument @Valid DeviceFilterInput filter,
                                                          DgsDataFetchingEnvironment dfe) {
        DeviceFilterCriteria filterOptions = mapper.toDeviceFilterCriteria(filter);
        Set<DeviceFilterFacet> facets = requestedFacets(dfe);
        log.debug("Fetching device filters with filter: {}, facets: {}", filter, facets);

        return deviceFilterService.getDeviceFilters(filterOptions, facets);
    }

    /**
     * The {@code DeviceFilters} fields this query actually selected.
     *
     * Each facet is its own Pinot round trip, and the callers are lopsided: the filter UI asks for
     * all six, while the onboarding auto-detect asks for {@code filteredCount} alone and the
     * dashboard counters for two. Resolving the whole object regardless of the selection set meant
     * a one-integer query still paid for six round trips.
     *
     * Falls back to every facet when there is no selection set to read, so a caller that somehow
     * arrives without one keeps the old, complete result rather than an empty one.
     */
    private static Set<DeviceFilterFacet> requestedFacets(DgsDataFetchingEnvironment dfe) {
        DataFetchingFieldSelectionSet selectionSet = dfe != null ? dfe.getSelectionSet() : null;
        if (selectionSet == null) {
            return DeviceFilterFacet.ALL;
        }
        EnumSet<DeviceFilterFacet> facets = EnumSet.noneOf(DeviceFilterFacet.class);
        for (DeviceFilterFacet facet : DeviceFilterFacet.values()) {
            if (selectionSet.contains(facet.graphQlField())) {
                facets.add(facet);
            }
        }
        return facets;
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<Machine>> devices(
            @InputArgument @Valid DeviceFilterInput filter,
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before,
            @InputArgument String search,
            @InputArgument @Valid SortInput sort) {

        log.debug("Fetching devices with filter: {}, first: {}, after: {}, last: {}, before: {}, search: {}, sort: {}",
            filter, first, after, last, before, search, sort);
        DeviceFilterCriteria filterOptions = mapper.toDeviceFilterCriteria(filter);
        ConnectionArgs connectionArgs = ConnectionArgs.builder().first(first).after(after).last(last).before(before).build();
        CursorPaginationCriteria paginationCriteria = mapper.toCursorPaginationCriteria(connectionArgs);
        CountedGenericQueryResult<Machine> result = deviceService.queryDevices(filterOptions, paginationCriteria, search, sort);
        return mapper.toDeviceConnection(result);
    }

    @DgsQuery
    public Machine deviceById(@InputArgument @NotBlank String id) {
        String machineId = relayIdCodec.decode(id, MACHINE);
        log.debug("Fetching device by global ID: {}, machineId: {}", id, machineId);
        return deviceService.findByMachineId(machineId).orElse(null);
    }

    @DgsQuery
    public Machine device(@InputArgument @NotBlank String machineId) {
        log.debug("Fetching device with machineId: {}", machineId);
        return deviceService.findByMachineId(machineId).orElse(null);
    }

    @DgsMutation
    public Machine updateDeviceNickname(@InputArgument @NotBlank String machineId,
                                        @InputArgument String nickname) {
        log.debug("Updating nickname for machineId: {}", machineId);
        return deviceService.updateNickname(machineId, nickname);
    }

    @DgsData(parentType = "ToolConnection", field = "vulnerabilitiesUpdatedAt")
    public Instant toolConnectionVulnerabilitiesUpdatedAt(DgsDataFetchingEnvironment dfe) {
        ToolConnection tc = dfe.getSource();
        if (tc.getToolType() != ToolType.FLEET_MDM) {
            return null;
        }
        return fleetVulnerabilityStatusService.getLastCompletedVulnerabilityRunAt();
    }

    @DgsData(parentType = "Machine")
    public CompletableFuture<List<Tag>> tags(DgsDataFetchingEnvironment dfe) {
        DataLoader<String, List<Tag>> dataLoader = dfe.getDataLoader("tagDataLoader");
        Machine machine = dfe.getSource();
        return dataLoader.load(machine.getMachineId());
    }

    @DgsData(parentType = "Machine")
    public CompletableFuture<List<ToolConnection>> toolConnections(DgsDataFetchingEnvironment dfe) {
        DataLoader<String, List<ToolConnection>> dataLoader = dfe.getDataLoader("toolConnectionDataLoader");
        Machine machine = dfe.getSource();
        return dataLoader.load(machine.getMachineId());
    }

    @DgsData(parentType = "Machine")
    public CompletableFuture<List<InstalledAgent>> installedAgents(DgsDataFetchingEnvironment dfe) {
        DataLoader<String, List<InstalledAgent>> dataLoader = dfe.getDataLoader("installedAgentDataLoader");
        Machine machine = dfe.getSource();
        return dataLoader.load(machine.getMachineId());
    }

    @DgsData(parentType = "Machine")
    public CompletableFuture<Organization> organization(DgsDataFetchingEnvironment dfe) {
        DataLoader<String, Organization> dataLoader = dfe.getDataLoader(OrganizationDataLoader.NAME);
        Machine machine = dfe.getSource();
        String organizationId = machine.getOrganizationId();
        
        if (organizationId == null) {
            return CompletableFuture.completedFuture(null);
        }
        
        return dataLoader.load(organizationId)
                .thenApply(org -> org != null && org.getStatus() == OrganizationStatus.ACTIVE ? org : null);
    }

    @DgsData(parentType = "Machine")
    public MachinePackageManagersResponse packageManagers(DgsDataFetchingEnvironment dfe) {
        Machine machine = dfe.getSource();
        return mapper.toPackageManagers(machine.getPackageManagers());
    }

    @DgsData(parentType = "Machine")
    public boolean softwareManagementSupported(DgsDataFetchingEnvironment dfe) {
        Machine machine = dfe.getSource();
        return packageManagerAvailability.isSoftwareManageable(machine);
    }

}
