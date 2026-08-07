package com.openframe.api.service;

import com.openframe.api.config.DeviceFilterExecutorConfig;
import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.device.DeviceFilterFacet;
import com.openframe.api.dto.device.DeviceFilters;
import com.openframe.data.pinot.repository.PinotDeviceRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.function.Supplier;

import static com.openframe.api.dto.device.DeviceFilterFacet.DEVICE_TYPES;
import static com.openframe.api.dto.device.DeviceFilterFacet.FILTERED_COUNT;
import static com.openframe.api.dto.device.DeviceFilterFacet.ORGANIZATION_IDS;
import static com.openframe.api.dto.device.DeviceFilterFacet.OS_TYPES;
import static com.openframe.api.dto.device.DeviceFilterFacet.STATUSES;
import static com.openframe.api.dto.device.DeviceFilterFacet.TAG_KEYS;
import static java.util.Collections.emptyList;
import static java.util.concurrent.CompletableFuture.completedFuture;
import static java.util.concurrent.CompletableFuture.supplyAsync;

@Service
@Slf4j
public class DeviceFilterService {

    private final PinotDeviceRepository pinotDeviceRepository;
    private final DeviceFilterOptionMapper optionMapper;
    private final TenantIdProvider tenantIdProvider;
    private final Executor facetExecutor;

    public DeviceFilterService(PinotDeviceRepository pinotDeviceRepository,
                              DeviceFilterOptionMapper optionMapper,
                              TenantIdProvider tenantIdProvider,
                              @Qualifier(DeviceFilterExecutorConfig.DEVICE_FILTER_FACET_EXECUTOR)
                              Executor facetExecutor) {
        this.pinotDeviceRepository = pinotDeviceRepository;
        this.optionMapper = optionMapper;
        this.tenantIdProvider = tenantIdProvider;
        this.facetExecutor = facetExecutor;
    }

    /**
     * Every facet. For callers with no selection set of their own — the external REST API, whose
     * response DTO always carries all of them.
     */
    public CompletableFuture<DeviceFilters> getDeviceFilters(DeviceFilterCriteria filters) {
        return getDeviceFilters(filters, DeviceFilterFacet.ALL);
    }

    /**
     * Only the requested facets; each one skipped is one Pinot round trip not made.
     *
     * Unrequested facets come back as empty lists (the mappers map {@code null} to
     * {@code List.of()}), never {@code null}, so the non-null GraphQL list types hold even if a
     * field is somehow read without having been selected. {@code filteredCount} is the exception —
     * it is a scalar and stays {@code null} when unrequested, which is only observable if a caller
     * asks for it without listing it in {@code requestedFacets}.
     *
     * @param requestedFacets facets to compute; {@code null} means all, EMPTY means none.
     */
    public CompletableFuture<DeviceFilters> getDeviceFilters(DeviceFilterCriteria filters,
                                                             Set<DeviceFilterFacet> requestedFacets) {
        Set<DeviceFilterFacet> facets = requestedFacets != null ? requestedFacets : DeviceFilterFacet.ALL;
        List<String> statuses = filters != null && filters.getStatuses() != null ?
                filters.getStatuses().stream().map(Enum::name).toList() : emptyList();
        List<String> deviceTypes = filters != null && filters.getDeviceTypes() != null ?
                filters.getDeviceTypes().stream().map(Enum::name).toList() : emptyList();
        List<String> osTypes = filters != null ? filters.getOsTypes() : emptyList();
        List<String> organizationIds = filters != null ? filters.getOrganizationIds() : emptyList();
        List<String> tagKeys = filters != null ? filters.getTagKeys() : emptyList();
        List<String> tagKeyValues = buildTagKeyValuesFilter(filters);

        String tenantId = tenantIdProvider.getTenantId();

        CompletableFuture<Map<String, Integer>> statusesFuture = facetQuery(facets, STATUSES, () ->
                pinotDeviceRepository.getStatusFilterOptions(tenantId, statuses, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues));
        CompletableFuture<Map<String, Integer>> deviceTypesFuture = facetQuery(facets, DEVICE_TYPES, () ->
                pinotDeviceRepository.getDeviceTypeFilterOptions(tenantId, statuses, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues));
        CompletableFuture<Map<String, Integer>> osTypesFuture = facetQuery(facets, OS_TYPES, () ->
                pinotDeviceRepository.getOsTypeFilterOptions(tenantId, statuses, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues));
        CompletableFuture<Map<String, Integer>> organizationsFuture = facetQuery(facets, ORGANIZATION_IDS, () ->
                pinotDeviceRepository.getOrganizationFilterOptions(tenantId, statuses, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues));
        CompletableFuture<Map<String, Integer>> tagKeysFuture = facetQuery(facets, TAG_KEYS, () ->
                pinotDeviceRepository.getTagKeyFilterOptions(tenantId, statuses, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues));
        CompletableFuture<Integer> filteredCountFuture = facetQuery(facets, FILTERED_COUNT, () ->
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
     * Submits one facet query, or short-circuits to {@code null} when the caller didn't ask for it.
     *
     * The executor is explicit on purpose — see {@link DeviceFilterExecutorConfig} for why the
     * {@code supplyAsync} default is wrong for these blocking Pinot calls.
     */
    private <T> CompletableFuture<T> facetQuery(Set<DeviceFilterFacet> facets,
                                                DeviceFilterFacet facet,
                                                Supplier<T> query) {
        if (!facets.contains(facet)) {
            return completedFuture(null);
        }
        return supplyAsync(query, facetExecutor);
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