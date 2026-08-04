package com.openframe.api.service;

import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.device.DeviceFilters;
import com.openframe.data.pinot.repository.PinotDeviceRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static java.util.Collections.emptyList;

@Service
@Slf4j
public class DeviceFilterService {

    private final PinotDeviceRepository pinotDeviceRepository;
    private final DeviceFilterOptionMapper optionMapper;
    private final TenantIdProvider tenantIdProvider;

    public DeviceFilterService(PinotDeviceRepository pinotDeviceRepository,
                              DeviceFilterOptionMapper optionMapper,
                              TenantIdProvider tenantIdProvider) {
        this.pinotDeviceRepository = pinotDeviceRepository;
        this.optionMapper = optionMapper;
        this.tenantIdProvider = tenantIdProvider;
    }

    public CompletableFuture<DeviceFilters> getDeviceFilters(DeviceFilterCriteria filters) {
        List<String> statuses = filters != null && filters.getStatuses() != null ?
                filters.getStatuses().stream().map(Enum::name).toList() : emptyList();
        List<String> deviceTypes = filters != null && filters.getDeviceTypes() != null ?
                filters.getDeviceTypes().stream().map(Enum::name).toList() : emptyList();
        List<String> osTypes = filters != null ? filters.getOsTypes() : emptyList();
        List<String> organizationIds = filters != null ? filters.getOrganizationIds() : emptyList();
        List<String> tagKeys = filters != null ? filters.getTagKeys() : emptyList();
        List<String> tagKeyValues = buildTagKeyValuesFilter(filters);

        String tenantId = tenantIdProvider.getTenantId();

        CompletableFuture<Map<String, Integer>> statusesFuture = CompletableFuture.supplyAsync(() ->
                pinotDeviceRepository.getStatusFilterOptions(tenantId, statuses, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues));
        CompletableFuture<Map<String, Integer>> deviceTypesFuture = CompletableFuture.supplyAsync(() ->
                pinotDeviceRepository.getDeviceTypeFilterOptions(tenantId, statuses, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues));
        CompletableFuture<Map<String, Integer>> osTypesFuture = CompletableFuture.supplyAsync(() ->
                pinotDeviceRepository.getOsTypeFilterOptions(tenantId, statuses, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues));
        CompletableFuture<Map<String, Integer>> organizationsFuture = CompletableFuture.supplyAsync(() ->
                pinotDeviceRepository.getOrganizationFilterOptions(tenantId, statuses, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues));
        CompletableFuture<Map<String, Integer>> tagKeysFuture = CompletableFuture.supplyAsync(() ->
                pinotDeviceRepository.getTagKeyFilterOptions(tenantId, statuses, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues));
        CompletableFuture<Integer> filteredCountFuture = CompletableFuture.supplyAsync(() ->
                pinotDeviceRepository.getFilteredDeviceCount(tenantId, statuses, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues));

        return CompletableFuture.allOf(
                        statusesFuture, deviceTypesFuture, osTypesFuture,
                        organizationsFuture, tagKeysFuture, filteredCountFuture)
                .thenApply(v -> DeviceFilters.builder()
                        .statuses(optionMapper.selfLabeled(statusesFuture.join()))
                        .deviceTypes(optionMapper.selfLabeled(deviceTypesFuture.join()))
                        .osTypes(optionMapper.selfLabeled(osTypesFuture.join()))
                        .organizationIds(optionMapper.organizationLabeled(organizationsFuture.join()))
                        .tagKeys(optionMapper.tagLabeled(tagKeysFuture.join()))
                        .filteredCount(filteredCountFuture.join())
                        .build()
                );
    }

    /**
     * Builds the tagKeyValues filter list for Pinot queries.
     * Combines tagKeys and tagValues from DeviceFilterCriteria into "key:value" format.
     * If only tagValues are provided (no tagKeys), passes them as-is for partial matching.
     */
    private List<String> buildTagKeyValuesFilter(DeviceFilterCriteria filters) {
        if (filters == null) {
            return emptyList();
        }

        List<String> tagKeys = filters.getTagKeys();
        List<String> tagValues = filters.getTagValues();

        boolean hasKeys = tagKeys != null && !tagKeys.isEmpty();
        boolean hasValues = tagValues != null && !tagValues.isEmpty();

        if (!hasKeys && !hasValues) {
            return emptyList();
        }

        if (hasKeys && hasValues) {
            // Build cross-product of key:value pairs for Pinot filtering
            List<String> keyValues = new ArrayList<>();
            for (String key : tagKeys) {
                for (String value : tagValues) {
                    keyValues.add(key + ":" + value);
                }
            }
            return keyValues;
        }

        // If only values without keys, search for any key with those values
        if (hasValues) {
            // Pass values as partial match patterns - the Pinot column stores "key:value"
            // Without knowing the key, we can't construct exact matches.
            // This case is handled at the MongoDB level in DeviceService.resolveTagFilterToMachineIds
            return emptyList();
        }

        // If only keys without values, the tagKeys filter in buildWhereClause handles this
        return emptyList();
    }

}