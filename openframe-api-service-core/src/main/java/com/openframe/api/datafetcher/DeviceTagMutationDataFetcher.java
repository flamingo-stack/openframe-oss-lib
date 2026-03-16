package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.device.*;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.service.DeviceService;
import com.openframe.api.service.TagService;
import com.openframe.data.document.device.Machine;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;

import java.util.List;

@DgsComponent
@Slf4j
@Validated
@RequiredArgsConstructor
public class DeviceTagMutationDataFetcher {

    private final DeviceService deviceService;
    private final TagService tagService;

    @DgsMutation
    public DeviceTag assignTagToDevice(@InputArgument @NotBlank String machineId,
                                        @InputArgument @Valid AssignTagInput input) {
        log.info("Assigning tag via GraphQL - machineId: {}, tagId: {}, key: {}",
                machineId, input.getTagId(), input.getKey());

        Machine machine = findMachineOrThrow(machineId);

        String resolvedTagId = tagService.resolveTagId(
                input.getTagId(), input.getKey(), machine.getOrganizationId(),
                input.getValues());
        tagService.assignTagToDevice(machine.getMachineId(), resolvedTagId, input.getValues(),
                machine.getOrganizationId());

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

        Machine machine = findMachineOrThrow(machineId);

        for (AssignTagInput tag : input.getTags()) {
            String resolvedTagId = tagService.resolveTagId(
                    tag.getTagId(), tag.getKey(), machine.getOrganizationId(),
                    tag.getValues());
            tagService.assignTagToDevice(machine.getMachineId(), resolvedTagId, tag.getValues(),
                    machine.getOrganizationId());
        }

        return tagService.getDeviceTagsForMachine(machine.getMachineId());
    }

    @DgsMutation
    public DeviceTag updateDeviceTagValues(@InputArgument @NotBlank String machineId,
                                            @InputArgument @NotBlank String tagId,
                                            @InputArgument @Valid UpdateDeviceTagValuesInput input) {
        log.info("Updating tag {} values on device {} via GraphQL", tagId, machineId);

        Machine machine = findMachineOrThrow(machineId);

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

        Machine machine = findMachineOrThrow(machineId);

        tagService.removeTagFromDevice(machine.getMachineId(), tagId);
        return true;
    }

    @DgsMutation
    public boolean bulkAssignTag(@InputArgument @Valid BulkAssignTagInput input) {
        log.info("Bulk assigning tag (tagId={}, key={}) to {} devices via GraphQL",
                input.getTagId(), input.getKey(), input.getMachineIds().size());

        String firstMachineId = input.getMachineIds().get(0);
        Machine firstMachine = findMachineOrThrow(firstMachineId);
        String organizationId = firstMachine.getOrganizationId();

        String resolvedTagId = tagService.resolveTagId(
                input.getTagId(), input.getKey(), organizationId,
                input.getValues());
        tagService.bulkAssignTag(input.getMachineIds(), resolvedTagId, input.getValues(),
                organizationId);
        return true;
    }

    @DgsMutation
    public boolean bulkRemoveTag(@InputArgument @Valid BulkRemoveTagInput input) {
        log.info("Bulk removing tag {} from {} devices via GraphQL",
                input.getTagId(), input.getMachineIds().size());

        tagService.bulkRemoveTag(input.getMachineIds(), input.getTagId());
        return true;
    }

    private Machine findMachineOrThrow(String machineId) {
        return deviceService.findByMachineId(machineId)
                .orElseThrow(() -> new DeviceNotFoundException("Device not found with ID: " + machineId));
    }
}
