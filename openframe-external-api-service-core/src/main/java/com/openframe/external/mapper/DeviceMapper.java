package com.openframe.external.mapper;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.device.*;
import com.openframe.data.document.device.Machine;
import com.openframe.external.dto.device.*;
import com.openframe.external.dto.shared.SortCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.shared.SortDirection;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class DeviceMapper extends BaseRestMapper {

    public DeviceResponse toDeviceResponse(Machine machine, List<DeviceTag> deviceTags) {
        return DeviceResponse.builder()
                .id(machine.getId())
                .machineId(machine.getMachineId())
                .hostname(machine.getHostname())
                .displayName(machine.getDisplayName())
                .ip(machine.getIp())
                .macAddress(machine.getMacAddress())
                .osUuid(machine.getOsUuid())
                .agentVersion(machine.getAgentVersion())
                .status(machine.getStatus())
                .lastSeen(machine.getLastSeen())
                .organizationId(machine.getOrganizationId())
                .serialNumber(machine.getSerialNumber())
                .manufacturer(machine.getManufacturer())
                .model(machine.getModel())
                .type(machine.getType())
                .osType(machine.getOsType())
                .osVersion(machine.getOsVersion())
                .osBuild(machine.getOsBuild())
                .timezone(machine.getTimezone())
                .registeredAt(machine.getRegisteredAt())
                .updatedAt(machine.getUpdatedAt())
                .tags(toDeviceTagResponses(deviceTags))
                .build();
    }

    public DevicesResponse toDevicesResponse(CountedGenericQueryResult<Machine> queryResult) {
        List<DeviceResponse> deviceResponses = queryResult.getItems().stream()
                .map(machine -> toDeviceResponse(machine, List.of()))
                .collect(Collectors.toList());

        return DevicesResponse.builder()
                .devices(deviceResponses)
                .pageInfo(toRestPageInfo(queryResult.getPageInfo()))
                .filteredCount(queryResult.getFilteredCount())
                .build();
    }

    public DevicesResponse toDevicesResponseWithDeviceTags(
            CountedGenericQueryResult<Machine> queryResult,
            List<List<DeviceTag>> deviceTagsPerMachine) {
        List<Machine> devices = queryResult.getItems();

        List<DeviceResponse> deviceResponses = java.util.stream.IntStream.range(0, devices.size())
                .mapToObj(i -> {
                    Machine machine = devices.get(i);
                    List<DeviceTag> deviceTags = i < deviceTagsPerMachine.size()
                            ? deviceTagsPerMachine.get(i) : List.of();
                    return toDeviceResponse(machine, deviceTags);
                })
                .collect(Collectors.toList());

        return DevicesResponse.builder()
                .devices(deviceResponses)
                .pageInfo(toRestPageInfo(queryResult.getPageInfo()))
                .filteredCount(queryResult.getFilteredCount())
                .build();
    }

    public DeviceTagResponse toDeviceTagResponse(DeviceTag deviceTag) {
        return DeviceTagResponse.builder()
                .tagId(deviceTag.getTagId())
                .key(deviceTag.getKey())
                .description(deviceTag.getDescription())
                .color(deviceTag.getColor())
                .values(deviceTag.getValues() != null ? deviceTag.getValues() : List.of())
                .organizationId(deviceTag.getOrganizationId())
                .createdAt(deviceTag.getCreatedAt())
                .build();
    }

    private List<DeviceTagResponse> toDeviceTagResponses(List<DeviceTag> deviceTags) {
        if (deviceTags == null) {
            return List.of();
        }
        return deviceTags.stream()
                .map(this::toDeviceTagResponse)
                .collect(Collectors.toList());
    }

    public DeviceFilterResponse toDeviceFilterResponse(DeviceFilters filters) {
        return DeviceFilterResponse.builder()
                .statuses(toDeviceFilterOptions(filters.getStatuses()))
                .deviceTypes(toDeviceFilterOptions(filters.getDeviceTypes()))
                .osTypes(toDeviceFilterOptions(filters.getOsTypes()))
                .organizationIds(toDeviceFilterOptions(filters.getOrganizationIds()))
                .tagKeys(toTagFilterOptions(filters.getTagKeys()))
                .filteredCount(filters.getFilteredCount())
                .build();
    }

    public DeviceFilterOptions toDeviceFilterOptions(DeviceFilterCriteria criteria) {
        if (criteria == null) {
            return DeviceFilterOptions.builder().build();
        }

        DeviceFilterOptions.DeviceFilterOptionsBuilder builder = DeviceFilterOptions.builder()
                .statuses(criteria.getStatuses())
                .deviceTypes(criteria.getDeviceTypes())
                .osTypes(criteria.getOsTypes())
                .organizationIds(criteria.getOrganizationIds())
                .tagKeys(criteria.getTagKeys())
                .tagValues(criteria.getTagValues());

        return builder.build();
    }


    private List<DeviceFilterItem> toDeviceFilterOptions(List<DeviceFilterOption> options) {
        if (options == null) {
            return List.of();
        }
        return options.stream()
                .map(option -> DeviceFilterItem.builder()
                        .value(option.getValue())
                        .label(option.getLabel())
                        .count(option.getCount())
                        .build())
                .collect(Collectors.toList());
    }

    private List<TagFilterItem> toTagFilterOptions(List<TagFilterOption> options) {
        if (options == null) {
            return List.of();
        }
        return options.stream()
                .map(option -> TagFilterItem.builder()
                        .value(option.getValue())
                        .label(option.getLabel())
                        .count(option.getCount())
                        .build())
                .collect(Collectors.toList());
    }

    public SortInput toSortInput(SortCriteria criteria) {
        if (criteria == null) {
            return null;
        }

        SortInput sortInput = new SortInput();
        sortInput.setField(criteria.getField());
        sortInput.setDirection(SortDirection.ASC.name().equalsIgnoreCase(criteria.getDirection()) ?
            SortDirection.ASC : SortDirection.DESC);

        return sortInput;
    }
}
