package com.openframe.data.pinot.repository;

import lombok.extern.slf4j.Slf4j;
import org.apache.pinot.client.Connection;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.function.Predicate;

import static com.openframe.data.document.device.DeviceStatus.DELETED;
import static com.openframe.data.document.device.DeviceStatus.OFFLINE;
import static com.openframe.data.document.device.DeviceStatus.ONLINE;

@Slf4j
@Repository
public class PinotClientDeviceRepository extends AbstractPinotRepository implements PinotDeviceRepository {

    private static final String STATUS = "status";
    private static final String DEVICE_TYPE = "deviceType";
    private static final String OS_TYPE = "osType";
    private static final String ORGANIZATION_ID = "organizationId";
    private static final String TAGS = "tags";
    private static final String TAG_KEY_VALUES = "tagKeyValues";

    /**
     * Statuses considered "active" for the organization device counts facet
     * ({@link #getOrganizationFilterOptions}). That facet counts only ONLINE and OFFLINE
     * devices; every other facet and the filtered device count keep the default behaviour
     * of excluding only DELETED devices.
     */
    private static final List<String> ACTIVE_STATUSES = List.of(ONLINE.name(), OFFLINE.name());

    /**
     * Explicit upper bound for faceted GROUP BY queries. Without an explicit LIMIT,
     * Pinot caps GROUP BY results at its default of 10 groups, which silently drops
     * low-count buckets (e.g. an organization with a single device). 10000 is the
     * builder's max and is comfortably above the number of distinct filter values.
     */
    private static final int MAX_FILTER_OPTIONS = 10000;

    @Value("${pinot.tables.devices.name:devices}")
    private String devicesTable;

    public PinotClientDeviceRepository(@Qualifier("pinotBrokerConnection") Connection pinotConnection) {
        super(pinotConnection);
    }

    @Override
    public Map<String, Integer> getStatusFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues) {
        return executeFacetQuery(STATUS, tenantId, statuses, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues, STATUS);
    }

    @Override
    public Map<String, Integer> getDeviceTypeFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues) {
        return executeFacetQuery(DEVICE_TYPE, tenantId, statuses, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues, DEVICE_TYPE);
    }

    @Override
    public Map<String, Integer> getOsTypeFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues) {
        return executeFacetQuery(OS_TYPE, tenantId, statuses, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues, OS_TYPE);
    }

    @Override
    public Map<String, Integer> getOrganizationFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues) {
        // Organization device counts only include active devices (ONLINE / OFFLINE).
        return executeActiveFacetQuery(ORGANIZATION_ID, tenantId, statuses, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues, ORGANIZATION_ID);
    }

    @Override
    public Map<String, Integer> getTagKeyFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues) {
        return executeFacetQuery(TAG_KEY_VALUES, tenantId, statuses, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues, TAG_KEY_VALUES);
    }

    @Override
    public int getFilteredDeviceCount(
            String tenantId,
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues) {
        PinotQueryBuilder queryBuilder = new PinotQueryBuilder(devicesTable, tenantId)
                .selectCountAll();
        applyDeviceFilters(queryBuilder, statuses, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues, null);
        return executeCountQuery(queryBuilder.build());
    }

    /**
     * Executes a faceted filter-option query, counting every device except DELETED:
     * SELECT {facetField}, COUNT(*) as count FROM devices WHERE <filters excluding facetField> GROUP BY {facetField} ORDER BY count DESC LIMIT {MAX_FILTER_OPTIONS}
     * The explicit LIMIT overrides Pinot's default GROUP BY cap of 10 groups so every bucket is returned.
     */
    private Map<String, Integer> executeFacetQuery(String facetField,
                                                    String tenantId,
                                                    List<String> statuses,
                                                    List<String> deviceTypes,
                                                    List<String> osTypes,
                                                    List<String> organizationIds,
                                                    List<String> tagKeys,
                                                    List<String> tagKeyValues,
                                                    String excludeField) {
        PinotQueryBuilder queryBuilder = newFacetQueryBuilder(facetField, tenantId);
        applyDeviceFilters(queryBuilder, statuses, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues, excludeField);
        return executeKeyCountQuery(queryBuilder.build());
    }

    /**
     * Same as {@link #executeFacetQuery} but counts only active devices (status ONLINE or OFFLINE).
     * Used by the organization device counts facet.
     */
    private Map<String, Integer> executeActiveFacetQuery(String facetField,
                                                         String tenantId,
                                                         List<String> statuses,
                                                         List<String> deviceTypes,
                                                         List<String> osTypes,
                                                         List<String> organizationIds,
                                                         List<String> tagKeys,
                                                         List<String> tagKeyValues,
                                                         String excludeField) {
        PinotQueryBuilder queryBuilder = newFacetQueryBuilder(facetField, tenantId);
        applyActiveDeviceFilters(queryBuilder, statuses, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues, excludeField);
        return executeKeyCountQuery(queryBuilder.build());
    }

    private PinotQueryBuilder newFacetQueryBuilder(String facetField, String tenantId) {
        return new PinotQueryBuilder(devicesTable, tenantId)
                .select(facetField)
                .selectCount()
                .groupBy(facetField)
                .orderByCountDesc()
                .limit(MAX_FILTER_OPTIONS);
    }

    /**
     * Applies the shared device filter set to a builder, excluding only DELETED devices.
     * If {@code excludeField} matches a filter's field, that filter is skipped (used for faceted filter-option queries).
     */
    private void applyDeviceFilters(PinotQueryBuilder queryBuilder,
                                    List<String> statuses,
                                    List<String> deviceTypes,
                                    List<String> osTypes,
                                    List<String> organizationIds,
                                    List<String> tagKeys,
                                    List<String> tagKeyValues,
                                    String excludeField) {
        queryBuilder.whereNotEquals(STATUS, DELETED.name());
        applyStatusFilter(queryBuilder, statuses, excludeField, status -> !DELETED.name().equals(status));
        applyNonStatusFilters(queryBuilder, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues, excludeField);
    }

    /**
     * Applies the shared device filter set to a builder, restricting the counted universe to
     * active devices (status ONLINE or OFFLINE) instead of the default exclude-only-DELETED rule.
     * If {@code excludeField} matches a filter's field, that filter is skipped.
     */
    private void applyActiveDeviceFilters(PinotQueryBuilder queryBuilder,
                                          List<String> statuses,
                                          List<String> deviceTypes,
                                          List<String> osTypes,
                                          List<String> organizationIds,
                                          List<String> tagKeys,
                                          List<String> tagKeyValues,
                                          String excludeField) {
        queryBuilder.whereIn(STATUS, ACTIVE_STATUSES);
        applyStatusFilter(queryBuilder, statuses, excludeField, ACTIVE_STATUSES::contains);
        applyNonStatusFilters(queryBuilder, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues, excludeField);
    }

    /**
     * Applies the caller-supplied status filter, keeping only the statuses accepted by {@code keep}
     * (so it never contradicts the base status restriction). Skipped when status is the faceted field.
     */
    private void applyStatusFilter(PinotQueryBuilder queryBuilder,
                                   List<String> statuses,
                                   String excludeField,
                                   Predicate<String> keep) {
        if (STATUS.equals(excludeField) || statuses == null) {
            return;
        }
        List<String> filteredStatuses = statuses.stream()
                .filter(status -> status != null && !status.isBlank())
                .filter(keep)
                .toList();
        if (!filteredStatuses.isEmpty()) {
            queryBuilder.whereOr(STATUS, filteredStatuses);
        }
    }

    private void applyNonStatusFilters(PinotQueryBuilder queryBuilder,
                                       List<String> deviceTypes,
                                       List<String> osTypes,
                                       List<String> organizationIds,
                                       List<String> tagKeys,
                                       List<String> tagKeyValues,
                                       String excludeField) {
        if (!DEVICE_TYPE.equals(excludeField) && deviceTypes != null && !deviceTypes.isEmpty()) {
            queryBuilder.whereOr(DEVICE_TYPE, deviceTypes);
        }

        if (!OS_TYPE.equals(excludeField) && osTypes != null && !osTypes.isEmpty()) {
            queryBuilder.whereOr(OS_TYPE, osTypes);
        }

        if (!ORGANIZATION_ID.equals(excludeField) && organizationIds != null && !organizationIds.isEmpty()) {
            queryBuilder.whereOr(ORGANIZATION_ID, organizationIds);
        }

        if (!TAGS.equals(excludeField) && tagKeys != null && !tagKeys.isEmpty()) {
            queryBuilder.whereOr(TAGS, tagKeys);
        }

        if (!TAG_KEY_VALUES.equals(excludeField) && tagKeyValues != null && !tagKeyValues.isEmpty()) {
            queryBuilder.whereOr(TAG_KEY_VALUES, tagKeyValues);
        }
    }
}
