package com.openframe.data.pinot.repository;

import lombok.extern.slf4j.Slf4j;
import org.apache.pinot.client.Connection;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;

import static com.openframe.data.document.device.DeviceStatus.DELETED;

@Slf4j
@Repository
public class PinotClientDeviceRepository extends AbstractPinotRepository implements PinotDeviceRepository {

    private static final String STATUS = "status";
    private static final String DEVICE_TYPE = "deviceType";
    private static final String OS_TYPE = "osType";
    private static final String ORGANIZATION_ID = "organizationId";
    private static final String TAGS = "tags";
    private static final String TAG_KEY_VALUES = "tagKeyValues";

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
        return executeFacetQuery(ORGANIZATION_ID, tenantId, statuses, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues, ORGANIZATION_ID);
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
     * Executes a faceted filter-option query:
     * SELECT {facetField}, COUNT(*) as count FROM devices WHERE <filters excluding facetField> GROUP BY {facetField} ORDER BY count DESC
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
        PinotQueryBuilder queryBuilder = new PinotQueryBuilder(devicesTable, tenantId)
                .select(facetField)
                .selectCount()
                .groupBy(facetField)
                .orderByCountDesc();
        applyDeviceFilters(queryBuilder, statuses, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues, excludeField);
        return executeKeyCountQuery(queryBuilder.build());
    }

    /**
     * Applies the shared device filter set to a builder. Always excludes DELETED devices.
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

        if (!STATUS.equals(excludeField) && statuses != null) {
            List<String> filteredStatuses = statuses.stream()
                    .filter(status -> status != null && !status.isBlank())
                    .filter(status -> !DELETED.name().equals(status))
                    .toList();
            if (!filteredStatuses.isEmpty()) {
                queryBuilder.whereOr(STATUS, filteredStatuses);
            }
        }

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
