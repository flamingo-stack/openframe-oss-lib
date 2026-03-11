package com.openframe.data.pinot.repository;

import java.util.List;
import java.util.Map;

public interface PinotDeviceRepository {

    Map<String, Integer> getStatusFilterOptions(
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> tagTypes
    );

    Map<String, Integer> getDeviceTypeFilterOptions(
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> tagTypes
    );

    Map<String, Integer> getOsTypeFilterOptions(
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> tagTypes
    );

    Map<String, Integer> getOrganizationFilterOptions(
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> tagTypes
    );

    /**
     * Get tag key filter options from the tags MV column.
     */
    Map<String, Integer> getTagKeyFilterOptions(
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> tagTypes
    );

    /**
     * Get tag type filter options from the tagTypes MV column.
     */
    Map<String, Integer> getTagTypeFilterOptions(
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> tagTypes
    );

    int getFilteredDeviceCount(
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> tagTypes
    );
}
