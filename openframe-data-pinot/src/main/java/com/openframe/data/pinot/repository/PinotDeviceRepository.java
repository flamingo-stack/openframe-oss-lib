package com.openframe.data.pinot.repository;

import java.util.List;
import java.util.Map;

public interface PinotDeviceRepository {

    Map<String, Integer> getStatusFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues
    );

    Map<String, Integer> getDeviceTypeFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues
    );

    Map<String, Integer> getOsTypeFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues
    );

    Map<String, Integer> getOrganizationFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues
    );

    /**
     * Get tag key filter options from the tags MV column.
     */
    Map<String, Integer> getTagKeyFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues
    );

    int getFilteredDeviceCount(
            String tenantId,
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues
    );
}
