package com.openframe.api.service;

import com.openframe.api.dto.device.DeviceFilterOptions;
import com.openframe.api.dto.device.DeviceFilters;
import com.openframe.api.dto.device.DeviceFilterOption;
import com.openframe.api.dto.device.TagFilterOption;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.pinot.PinotDeviceRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

import static java.util.Collections.emptyList;

@Service
@Slf4j
public class DeviceFilterService {

    private final PinotDeviceRepository pinotDeviceRepository;
    private final OrganizationRepository organizationRepository;

    public DeviceFilterService(PinotDeviceRepository pinotDeviceRepository,
                              OrganizationRepository organizationRepository) {
        this.pinotDeviceRepository = pinotDeviceRepository;
        this.organizationRepository = organizationRepository;
    }

    public CompletableFuture<DeviceFilters> getDeviceFilters(DeviceFilterOptions filters) {
        List<String> statuses = filters != null && filters.getStatuses() != null ?
                filters.getStatuses().stream().map(Enum::name).toList() : emptyList();
        List<String> deviceTypes = filters != null && filters.getDeviceTypes() != null ?
                filters.getDeviceTypes().stream().map(Enum::name).toList() : emptyList();
        List<String> osTypes = filters != null ? filters.getOsTypes() : emptyList();
        List<String> organizationIds = filters != null ? filters.getOrganizationIds() : emptyList();
        List<String> tagNames = filters != null ? filters.getTagNames() : emptyList();

        CompletableFuture<Map<String, Integer>> statusesFuture = CompletableFuture.supplyAsync(() ->
                pinotDeviceRepository.getStatusFilterOptions(statuses, deviceTypes, osTypes, organizationIds, tagNames));
        CompletableFuture<Map<String, Integer>> deviceTypesFuture = CompletableFuture.supplyAsync(() ->
                pinotDeviceRepository.getDeviceTypeFilterOptions(statuses, deviceTypes, osTypes, organizationIds, tagNames));
        CompletableFuture<Map<String, Integer>> osTypesFuture = CompletableFuture.supplyAsync(() ->
                pinotDeviceRepository.getOsTypeFilterOptions(statuses, deviceTypes, osTypes, organizationIds, tagNames));
        CompletableFuture<Map<String, Integer>> organizationsFuture = CompletableFuture.supplyAsync(() ->
                pinotDeviceRepository.getOrganizationFilterOptions(statuses, deviceTypes, osTypes, organizationIds, tagNames));
        CompletableFuture<Map<String, Integer>> tagsFuture = CompletableFuture.supplyAsync(() ->
                pinotDeviceRepository.getTagFilterOptions(statuses, deviceTypes, osTypes, organizationIds, tagNames));
        CompletableFuture<Integer> filteredCountFuture = CompletableFuture.supplyAsync(() ->
                pinotDeviceRepository.getFilteredDeviceCount(statuses, deviceTypes, osTypes, organizationIds, tagNames));

        return CompletableFuture.allOf(
                        statusesFuture, deviceTypesFuture, osTypesFuture,
                        organizationsFuture, tagsFuture, filteredCountFuture)
                .thenApply(v -> DeviceFilters.builder()
                        .statuses(convertMapToFilterOptions(statusesFuture.join()))
                        .deviceTypes(convertMapToFilterOptions(deviceTypesFuture.join()))
                        .osTypes(convertMapToFilterOptions(osTypesFuture.join()))
                        .organizationIds(convertMapToOrganizationFilterOptions(organizationsFuture.join()))
                        .tags(convertMapToTagFilterOptions(tagsFuture.join()))
                        .filteredCount(filteredCountFuture.join())
                        .build()
                );
    }

    private List<DeviceFilterOption> convertMapToFilterOptions(Map<String, Integer> repositoryOptions) {
        if (repositoryOptions == null || repositoryOptions.isEmpty()) {
            return new ArrayList<>();
        }
        return repositoryOptions.entrySet().stream()
                .map(entry -> DeviceFilterOption.builder()
                        .value(entry.getKey())
                        .label(entry.getKey())
                        .count(entry.getValue())
                        .build())
                .collect(Collectors.toList());
    }

    private List<TagFilterOption> convertMapToTagFilterOptions(Map<String, Integer> repositoryOptions) {
        if (repositoryOptions == null || repositoryOptions.isEmpty()) {
            return new ArrayList<>();
        }
        return repositoryOptions.entrySet().stream()
                .map(entry -> TagFilterOption.builder()
                        .value(entry.getKey())
                        .label(entry.getKey())
                        .count(entry.getValue())
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * Convert organization IDs map to filter options with organization names as labels.
     * 
     * Performance note:
     * - Only loads organizations that actually exist in the filter (typically 5-50 items)
     * - MongoDB index scan on organizationId: 1-5ms
     * - Simpler than Redis cache (no cache invalidation, no stale data, no extra dependency)
     * - Frontend already has Apollo Client cache for deviceFilters query
     */
    private List<DeviceFilterOption> convertMapToOrganizationFilterOptions(Map<String, Integer> repositoryOptions) {
        if (repositoryOptions == null || repositoryOptions.isEmpty()) {
            return new ArrayList<>();
        }

        // Get only the organization IDs that are present in filters (not all organizations)
        // Use Set directly from keySet() - no need to convert to ArrayList
        var organizationIds = repositoryOptions.keySet();
        
        // Batch load only needed organizations (1-5ms with MongoDB index)
        List<Organization> organizations = organizationRepository.findByOrganizationIdIn(organizationIds);
        
        // Create lookup map
        Map<String, String> organizationNames = organizations.stream()
                .collect(Collectors.toMap(
                        Organization::getOrganizationId,
                        Organization::getName
                ));

        // Build filter options with names as labels
        return repositoryOptions.entrySet().stream()
                .map(entry -> {
                    String organizationId = entry.getKey();
                    String organizationName = organizationNames.getOrDefault(organizationId, organizationId);
                    
                    return DeviceFilterOption.builder()
                            .value(organizationId)
                            .label(organizationName)
                            .count(entry.getValue())
                            .build();
                })
                .collect(Collectors.toList());
    }

} 