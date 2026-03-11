package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.*;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.device.*;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.CursorPaginationInput;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.mapper.GraphQLDeviceMapper;
import com.openframe.api.service.DeviceFilterService;
import com.openframe.api.service.DeviceService;
import com.openframe.api.service.TagService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.installedagents.InstalledAgent;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.tool.ToolConnection;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dataloader.DataLoader;
import org.springframework.validation.annotation.Validated;

import java.util.List;
import java.util.concurrent.CompletableFuture;

@DgsComponent
@Slf4j
@Validated
@RequiredArgsConstructor
public class DeviceDataFetcher {

    private final DeviceService deviceService;
    private final DeviceFilterService deviceFilterService;
    private final TagService tagService;
    private final GraphQLDeviceMapper mapper;

    @DgsQuery
    public CompletableFuture<DeviceFilters> deviceFilters(@InputArgument @Valid DeviceFilterInput filter) {
        log.debug("Fetching device filters with filter: {}", filter);
        DeviceFilterOptions filterOptions = mapper.toDeviceFilterOptions(filter);

        return deviceFilterService.getDeviceFilters(filterOptions);
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<Machine>> devices(
            @InputArgument @Valid DeviceFilterInput filter,
            @InputArgument @Valid CursorPaginationInput pagination,
            @InputArgument String search,
            @InputArgument @Valid SortInput sort) {

        log.debug("Fetching devices with filter: {}, pagination: {}, search: {}, sort: {}",
            filter, pagination, search, sort);
        DeviceFilterOptions filterOptions = mapper.toDeviceFilterOptions(filter);
        CursorPaginationCriteria paginationCriteria = mapper.toCursorPaginationCriteria(pagination);
        CountedGenericQueryResult<Machine> result = deviceService.queryDevices(filterOptions, paginationCriteria, search, sort);
        return mapper.toDeviceConnection(result);
    }

    @DgsQuery
    public Machine device(@InputArgument @NotBlank String machineId) {
        log.debug("Fetching device with ID: {}", machineId);
        return deviceService.findByMachineId(machineId).orElse(null);
    }

    @DgsData(parentType = "Machine")
    public CompletableFuture<List<DeviceTag>> tags(DgsDataFetchingEnvironment dfe) {
        DataLoader<String, List<DeviceTag>> dataLoader = dfe.getDataLoader("tagDataLoader");
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
        
        return dataLoader.load(organizationId);
    }

    @DgsMutation
    public Machine createDevice(@InputArgument @Valid CreateDeviceInput input) {
        log.info("Creating device via GraphQL - org: {}, osType: {}, type: {}, tags: {}",
                input.getOrganizationId(), input.getOsType(), input.getType(),
                input.getTags() != null ? input.getTags().size() : 0);

        Machine machine = deviceService.createDevice(
                input.getOrganizationId(),
                input.getDisplayName(),
                input.getHostname(),
                input.getType(),
                input.getOsType());

        // Assign tags if provided
        if (input.getTags() != null && !input.getTags().isEmpty()) {
            for (DeviceTagInput tagInput : input.getTags()) {
                String resolvedTagId = tagService.resolveTagId(
                        null, tagInput.getKey(), input.getOrganizationId(), null);
                tagService.assignTagToDevice(machine.getMachineId(), resolvedTagId,
                        tagInput.getValues(), null, input.getOrganizationId());
            }
        }
        return machine;
    }

    @DgsMutation
    public DeviceTag assignTagToDevice(@InputArgument @NotBlank String machineId,
                                        @InputArgument @Valid AssignTagInput input) {
        log.info("Assigning tag via GraphQL - machineId: {}, tagId: {}, key: {}",
                machineId, input.getTagId(), input.getKey());

        Machine machine = deviceService.findByMachineId(machineId)
                .orElseThrow(() -> new DeviceNotFoundException("Device not found with ID: " + machineId));

        String resolvedTagId = tagService.resolveTagId(
                input.getTagId(), input.getKey(), machine.getOrganizationId(), null);
        tagService.assignTagToDevice(machine.getMachineId(), resolvedTagId, input.getValues(),
                null, machine.getOrganizationId());

        // Return enriched DeviceTag
        return tagService.getDeviceTagsForMachine(machine.getMachineId()).stream()
                .filter(dt -> dt.getTagId().equals(resolvedTagId))
                .findFirst()
                .orElse(DeviceTag.builder()
                        .tagId(resolvedTagId)
                        .values(input.getValues() != null ? input.getValues() : List.of())
                        .build());
    }

    @DgsMutation
    public List<DeviceTag> batchAssignTagsToDevice(@InputArgument @NotBlank String machineId,
                                                    @InputArgument @Valid BatchAssignTagsInput input) {
        log.info("Batch assigning {} tags to device {} via GraphQL", input.getTags().size(), machineId);

        Machine machine = deviceService.findByMachineId(machineId)
                .orElseThrow(() -> new DeviceNotFoundException("Device not found with ID: " + machineId));

        for (AssignTagInput tag : input.getTags()) {
            String resolvedTagId = tagService.resolveTagId(
                    tag.getTagId(), tag.getKey(), machine.getOrganizationId(), null);
            tagService.assignTagToDevice(machine.getMachineId(), resolvedTagId, tag.getValues(),
                    null, machine.getOrganizationId());
        }

        return tagService.getDeviceTagsForMachine(machine.getMachineId());
    }

    @DgsMutation
    public DeviceTag updateDeviceTagValues(@InputArgument @NotBlank String machineId,
                                            @InputArgument @NotBlank String tagId,
                                            @InputArgument @Valid UpdateDeviceTagValuesInput input) {
        log.info("Updating tag {} values on device {} via GraphQL", tagId, machineId);

        Machine machine = deviceService.findByMachineId(machineId)
                .orElseThrow(() -> new DeviceNotFoundException("Device not found with ID: " + machineId));

        tagService.updateDeviceTagValues(machine.getMachineId(), tagId, input.getValues());

        return tagService.getDeviceTagsForMachine(machine.getMachineId()).stream()
                .filter(dt -> dt.getTagId().equals(tagId))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "Tag " + tagId + " not found on device " + machineId + " after update"));
    }

    @DgsMutation
    public boolean removeTagFromDevice(@InputArgument @NotBlank String machineId,
                                        @InputArgument @NotBlank String tagId) {
        log.info("Removing tag {} from device {} via GraphQL", tagId, machineId);

        Machine machine = deviceService.findByMachineId(machineId)
                .orElseThrow(() -> new DeviceNotFoundException("Device not found with ID: " + machineId));

        tagService.removeTagFromDevice(machine.getMachineId(), tagId);
        return true;
    }

    @DgsMutation
    public boolean bulkAssignTag(@InputArgument @Valid BulkAssignTagInput input) {
        log.info("Bulk assigning tag (tagId={}, key={}) to {} devices via GraphQL",
                input.getTagId(), input.getKey(), input.getMachineIds().size());

        // Extract organizationId from the first machine to scope the operation
        String firstMachineId = input.getMachineIds().get(0);
        Machine firstMachine = deviceService.findByMachineId(firstMachineId)
                .orElseThrow(() -> new DeviceNotFoundException("Device not found with ID: " + firstMachineId));
        String organizationId = firstMachine.getOrganizationId();

        String resolvedTagId = tagService.resolveTagId(
                input.getTagId(), input.getKey(), organizationId, null);
        tagService.bulkAssignTag(input.getMachineIds(), resolvedTagId, input.getValues(),
                null, organizationId);
        return true;
    }

    @DgsMutation
    public boolean bulkRemoveTag(@InputArgument @Valid BulkRemoveTagInput input) {
        log.info("Bulk removing tag {} from {} devices via GraphQL",
                input.getTagId(), input.getMachineIds().size());

        tagService.bulkRemoveTag(input.getMachineIds(), input.getTagId());
        return true;
    }
}
