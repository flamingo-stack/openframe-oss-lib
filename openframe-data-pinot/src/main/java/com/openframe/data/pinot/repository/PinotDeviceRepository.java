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
            List<String> tagKeyValues,
            List<String> directorySources,
            List<String> userLinks
    );

    Map<String, Integer> getDeviceTypeFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> directorySources,
            List<String> userLinks
    );

    Map<String, Integer> getOsTypeFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> directorySources,
            List<String> userLinks
    );

    Map<String, Integer> getOrganizationFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> directorySources,
            List<String> userLinks
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
            List<String> tagKeyValues,
            List<String> directorySources,
            List<String> userLinks
    );

    /**
     * SOURCES filter options from the directorySources MV column. A machine no directory knows adds no bucket.
     */
    Map<String, Integer> getDirectorySourceFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> directorySources,
            List<String> userLinks
    );

    /**
     * USER filter options from the directoryUserLink column. A machine the directory matcher never wrote is NONE.
     */
    Map<String, Integer> getUserLinkFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> directorySources,
            List<String> userLinks
    );

    int getFilteredDeviceCount(
            String tenantId,
            List<String> statuses,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> directorySources,
            List<String> userLinks
    );
}
