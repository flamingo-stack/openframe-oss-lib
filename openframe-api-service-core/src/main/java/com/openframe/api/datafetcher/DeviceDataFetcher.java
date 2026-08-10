package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.device.DeviceFilterInput;
import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.device.DeviceFilterFacet;
import com.openframe.api.dto.device.DeviceFilters;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLDeviceMapper;
import com.openframe.api.service.DeviceFilterService;
import com.openframe.api.service.DeviceService;
import com.openframe.api.service.TagService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.installedagents.InstalledAgent;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.OrganizationStatus;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tool.ToolConnection;
import graphql.relay.Relay;
import graphql.schema.DataFetchingFieldSelectionSet;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dataloader.DataLoader;
import org.springframework.validation.annotation.Validated;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

@DgsComponent
@Slf4j
@Validated
@RequiredArgsConstructor
public class DeviceDataFetcher {

    private static final Relay RELAY = new Relay();

    private final DeviceService deviceService;
    private final DeviceFilterService deviceFilterService;
    private final TagService tagService;
    private final GraphQLDeviceMapper mapper;

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
        String machineId = RELAY.fromGlobalId(id).getId();
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

    @DgsData(parentType = "Machine", field = "id")
    public String machineNodeId(DgsDataFetchingEnvironment dfe) {
        Machine machine = dfe.getSource();
        return RELAY.toGlobalId("Machine", machine.getMachineId());
    }

    @DgsData(parentType = "ToolConnection", field = "id")
    public String toolConnectionNodeId(DgsDataFetchingEnvironment dfe) {
        ToolConnection tc = dfe.getSource();
        return RELAY.toGlobalId("ToolConnection", tc.getId());
    }

    @DgsData(parentType = "InstalledAgent", field = "id")
    public String installedAgentNodeId(DgsDataFetchingEnvironment dfe) {
        InstalledAgent agent = dfe.getSource();
        return RELAY.toGlobalId("InstalledAgent", agent.getId());
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
        DataLoader<String, Organization> dataLoader = dfe.getDataLoader("organizationDataLoader");
        Machine machine = dfe.getSource();
        String organizationId = machine.getOrganizationId();
        
        if (organizationId == null) {
            return CompletableFuture.completedFuture(null);
        }
        
        return dataLoader.load(organizationId)
                .thenApply(org -> org != null && org.getStatus() == OrganizationStatus.ACTIVE ? org : null);
    }

}
