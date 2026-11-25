package com.openframe.api.dto.device;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceFilters {
    private List<DeviceFilterOption> statuses;
    private List<DeviceFilterOption> connectivity;
    private List<DeviceFilterOption> clientOutdated;
    private List<DeviceFilterOption> deviceTypes;
    private List<DeviceFilterOption> osTypes;
    private List<DeviceFilterOption> organizationIds;
    private List<TagFilterOption> tagKeys;
    private List<DeviceFilterOption> directorySources;
    private List<DeviceFilterOption> userLinks;
    @Builder.Default
    private List<DeviceFilterOption> mdmStates = List.of();
    @Builder.Default
    private List<DeviceFilterOption> diskEncryptionStates = List.of();
    private Integer filteredCount;
} 