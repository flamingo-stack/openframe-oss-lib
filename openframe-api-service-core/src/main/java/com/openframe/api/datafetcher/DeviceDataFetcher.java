package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dataloader.MachineTagDataLoader;
import com.openframe.api.dataloader.OrganizationDataLoader;
import com.openframe.api.dataloader.UnreadNotificationDataLoader;
import com.openframe.api.dataloader.UnreadNotificationKey;
import com.openframe.api.dto.notification.NotificationRecipient;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.device.DeviceEnrollmentResponse;
import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.device.DeviceFilterInput;
import com.openframe.api.dto.device.DeviceFilterFacet;
import com.openframe.api.dto.device.DeviceFilters;
import com.openframe.api.dto.device.MachinePackageManagersResponse;
import com.openframe.api.dto.device.MachineTag;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLDeviceMapper;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.api.service.device.ChocolateyDecisionService;
import com.openframe.api.service.device.DeviceFilterService;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.FleetVulnerabilityStatusService;
import com.openframe.api.service.NotificationRecipientResolver;
import com.openframe.api.service.TagService;
import com.openframe.data.config.ClientVersionThreshold;
import com.openframe.data.document.device.DirectorySource;
import com.openframe.data.document.device.DirectoryUserLink;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.document.device.chocolatey.ChocolateyAdminOption;
import com.openframe.data.document.installedagents.InstalledAgent;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.OrganizationStatus;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.document.toolagent.UnsupportedTool;
import com.openframe.data.document.notification.NotificationEntityType;
import com.openframe.data.service.ToolOsSupportService;
import com.openframe.data.service.ToolOsSupportService.AgentWithToolType;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import com.openframe.security.authentication.AuthPrincipal;
import graphql.schema.DataFetchingFieldSelectionSet;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dataloader.DataLoader;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
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

    private static final String AGENTS_WITH_MIN_OS_VERSION = DeviceDataFetcher.class.getName() + ".agentsWithMinOsVersion";

    private final DeviceService deviceService;
    private final DeviceFilterService deviceFilterService;
    private final TagService tagService;
    private final FleetVulnerabilityStatusService fleetVulnerabilityStatusService;
    private final GraphQLDeviceMapper mapper;
    private final PackageManagerAvailability packageManagerAvailability;
    private final RelayIdCodec relayIdCodec;
    private final NotificationRecipientResolver recipientResolver;
    private final ClientVersionThreshold clientVersionThreshold;
    private final ToolOsSupportService toolOsSupportService;
    private final ChocolateyDecisionService chocolateyDecisionService;

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

    @DgsMutation
    public Machine setChocolateyDecision(@InputArgument @NotBlank String machineId,
                                         @InputArgument ChocolateyAdminOption option) {
        log.debug("Setting Chocolatey decision {} for machineId: {}", option, machineId);
        String decidedBy = getCurrentUserId();
        return chocolateyDecisionService.set(machineId, option, decidedBy);
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
    public CompletableFuture<List<MachineTag>> tagAssignments(DgsDataFetchingEnvironment dfe) {
        DataLoader<String, List<MachineTag>> dataLoader = dfe.getDataLoader(MachineTagDataLoader.NAME);
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
    public CompletableFuture<DeviceEnrollmentResponse> enrollment(DgsDataFetchingEnvironment dfe) {
        DataLoader<String, List<ToolConnection>> dataLoader = dfe.getDataLoader("toolConnectionDataLoader");
        Machine machine = dfe.getSource();
        return dataLoader.load(machine.getMachineId())
                .thenApply(toolConnections -> mapper.toEnrollment(machine, toolConnections));
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

    @DgsData(parentType = "Machine", field = "connectivity")
    public TelemetryStatus connectivity(DgsDataFetchingEnvironment dfe) {
        Machine machine = dfe.getSource();
        return machine.getTelemetryStatus();
    }

    @DgsData(parentType = "Machine", field = "clientOutdated")
    public boolean clientOutdated(DgsDataFetchingEnvironment dfe) {
        Machine machine = dfe.getSource();
        Long agentVersionKey = machine.getAgentVersionKey();
        return clientVersionThreshold.isOutdated(agentVersionKey);
    }

    @DgsData(parentType = "Machine")
    public MachinePackageManagersResponse packageManagers(DgsDataFetchingEnvironment dfe) {
        Machine machine = dfe.getSource();
        return mapper.toPackageManagers(machine);
    }

    @DgsData(parentType = "Machine")
    public boolean softwareManagementSupported(DgsDataFetchingEnvironment dfe) {
        Machine machine = dfe.getSource();
        return packageManagerAvailability.isSoftwareManageable(machine);
    }

    @DgsData(parentType = "Machine")
    public List<UnsupportedTool> unsupportedTools(DgsDataFetchingEnvironment dfe) {
        Machine machine = dfe.getSource();
        List<AgentWithToolType> agents = dfe.getGraphQlContext()
                .computeIfAbsent(AGENTS_WITH_MIN_OS_VERSION, key -> toolOsSupportService.agentsWithMinOsVersion());
        return toolOsSupportService.unsupportedTools(machine, agents);
    }

    @DgsData(parentType = "Machine")
    public List<DirectorySource> directorySources(DgsDataFetchingEnvironment dfe) {
        Machine machine = dfe.getSource();
        return mapper.toDirectorySources(machine);
    }

    @DgsData(parentType = "Machine")
    public DirectoryUserLink directoryUserLink(DgsDataFetchingEnvironment dfe) {
        Machine machine = dfe.getSource();
        return mapper.toDirectoryUserLink(machine);
    }

    @DgsData(parentType = "Machine")
    public List<String> directoryUserIds(DgsDataFetchingEnvironment dfe) {
        Machine machine = dfe.getSource();
        return mapper.toDirectoryUserIds(machine);
    }

    // The current user's unread notifications about this device, batched for the whole page: the
    // same read states the sidebar badge counts, so a row and the badge agree.
    @DgsData(parentType = "Machine")
    public CompletableFuture<Integer> unreadNotificationCount(DgsDataFetchingEnvironment dfe) {
        Machine machine = dfe.getSource();
        NotificationRecipient recipient = recipientResolver.current();
        UnreadNotificationKey key = new UnreadNotificationKey(
                recipient.id(), recipient.type(), NotificationEntityType.DEVICE, machine.getMachineId());
        DataLoader<UnreadNotificationKey, Integer> loader = dfe.getDataLoader(UnreadNotificationDataLoader.NAME);
        return loader.load(key);
    }

    private String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return AuthPrincipal.fromJwt((Jwt) auth.getPrincipal()).getId();
    }

}
