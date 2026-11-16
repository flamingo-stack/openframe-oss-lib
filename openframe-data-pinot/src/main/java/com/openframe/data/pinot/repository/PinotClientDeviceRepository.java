package com.openframe.data.pinot.repository;

import com.openframe.data.config.ClientVersionThreshold;
import lombok.extern.slf4j.Slf4j;
import org.apache.pinot.client.Connection;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.data.document.device.DeviceStatus.DELETED;
import static com.openframe.data.document.device.DeviceStatus.OFFLINE;
import static com.openframe.data.document.device.DeviceStatus.ONLINE;

@Slf4j
@Repository
public class PinotClientDeviceRepository extends AbstractPinotRepository implements PinotDeviceRepository {

    private static final String STATUS = "status";
    private static final String CONNECTIVITY = "connectivity";
    private static final String DEVICE_TYPE = "deviceType";
    private static final String OS_TYPE = "osType";
    private static final String ORGANIZATION_ID = "organizationId";
    private static final String TAGS = "tags";
    private static final String TAG_KEY_VALUES = "tagKeyValues";
    private static final String DIRECTORY_SOURCES = "directorySources";
    private static final String DIRECTORY_USER_LINK = "directoryUserLink";
    private static final String AGENT_VERSION_KEY = "agentVersionKey";
    // args: column, column, threshold key / column, column, threshold key, column
    private static final String OUTDATED_CONDITION = "(%s >= 0 AND %s < %d)";
    private static final String NOT_OUTDATED_CONDITION = "(%s < 0 OR %s >= %d OR %s IS NULL)";
    private static final String OUTDATED_FACET_VALUE = "true";
    private static final String NOT_OUTDATED_FACET_VALUE = "false";

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

    private final ClientVersionThreshold clientVersionThreshold;

    public PinotClientDeviceRepository(@Qualifier("pinotBrokerConnection") Connection pinotConnection,
                                       ClientVersionThreshold clientVersionThreshold) {
        super(pinotConnection);
        this.clientVersionThreshold = clientVersionThreshold;
    }

    @Override
    public Map<String, Integer> getStatusFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> connectivity,
            Boolean clientOutdated,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> directorySources,
            List<String> userLinks) {
        return executeFacetQuery(STATUS, tenantId, statuses, connectivity, clientOutdated, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues,
                directorySources, userLinks, STATUS);
    }

    @Override
    public Map<String, Integer> getConnectivityFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> connectivity,
            Boolean clientOutdated,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> directorySources,
            List<String> userLinks) {
        return executeFacetQuery(CONNECTIVITY, tenantId, statuses, connectivity, clientOutdated, deviceTypes, osTypes, organizationIds, tagKeys,
                tagKeyValues, directorySources, userLinks, CONNECTIVITY);
    }

    @Override
    public Map<String, Integer> getClientOutdatedFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> connectivity,
            Boolean clientOutdated,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> directorySources,
            List<String> userLinks) {
        // Two counts with the clientOutdated filter replaced by each side, every other filter as given
        int outdated = getFilteredDeviceCount(tenantId, statuses, connectivity, Boolean.TRUE, deviceTypes, osTypes,
                organizationIds, tagKeys, tagKeyValues, directorySources, userLinks);
        int notOutdated = getFilteredDeviceCount(tenantId, statuses, connectivity, Boolean.FALSE, deviceTypes, osTypes,
                organizationIds, tagKeys, tagKeyValues, directorySources, userLinks);
        Map<String, Integer> options = new LinkedHashMap<>();
        options.put(OUTDATED_FACET_VALUE, outdated);
        options.put(NOT_OUTDATED_FACET_VALUE, notOutdated);
        return options;
    }

    @Override
    public Map<String, Integer> getDeviceTypeFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> connectivity,
            Boolean clientOutdated,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> directorySources,
            List<String> userLinks) {
        return executeFacetQuery(DEVICE_TYPE, tenantId, statuses, connectivity, clientOutdated, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues,
                directorySources, userLinks, DEVICE_TYPE);
    }

    @Override
    public Map<String, Integer> getOsTypeFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> connectivity,
            Boolean clientOutdated,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> directorySources,
            List<String> userLinks) {
        return executeFacetQuery(OS_TYPE, tenantId, statuses, connectivity, clientOutdated, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues,
                directorySources, userLinks, OS_TYPE);
    }

    @Override
    public Map<String, Integer> getOrganizationFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> connectivity,
            Boolean clientOutdated,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> directorySources,
            List<String> userLinks) {
        // Organization device counts only include active devices (ONLINE / OFFLINE).
        return executeActiveFacetQuery(ORGANIZATION_ID, tenantId, statuses, connectivity, clientOutdated, deviceTypes, osTypes, organizationIds, tagKeys,
                tagKeyValues, directorySources, userLinks, ORGANIZATION_ID);
    }

    @Override
    public Map<String, Integer> getTagKeyFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> connectivity,
            Boolean clientOutdated,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> directorySources,
            List<String> userLinks) {
        return executeFacetQuery(TAG_KEY_VALUES, tenantId, statuses, connectivity, clientOutdated, deviceTypes, osTypes, organizationIds, tagKeys,
                tagKeyValues, directorySources, userLinks, TAG_KEY_VALUES);
    }

    @Override
    public Map<String, Integer> getDirectorySourceFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> connectivity,
            Boolean clientOutdated,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> directorySources,
            List<String> userLinks) {
        // A machine no directory knows stores [""] (the column's defaultNullValue), which executeKeyCountQuery skips.
        return executeFacetQuery(DIRECTORY_SOURCES, tenantId, statuses, connectivity, clientOutdated, deviceTypes, osTypes, organizationIds, tagKeys,
                tagKeyValues, directorySources, userLinks, DIRECTORY_SOURCES);
    }

    @Override
    public Map<String, Integer> getUserLinkFilterOptions(
            String tenantId,
            List<String> statuses,
            List<String> connectivity,
            Boolean clientOutdated,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> directorySources,
            List<String> userLinks) {
        // A machine no external directory integration wrote reads NONE (the column's defaultNullValue), so it is
        // counted.
        return executeFacetQuery(DIRECTORY_USER_LINK, tenantId, statuses, connectivity, clientOutdated, deviceTypes, osTypes, organizationIds, tagKeys,
                tagKeyValues, directorySources, userLinks, DIRECTORY_USER_LINK);
    }

    @Override
    public int getFilteredDeviceCount(
            String tenantId,
            List<String> statuses,
            List<String> connectivity,
            Boolean clientOutdated,
            List<String> deviceTypes,
            List<String> osTypes,
            List<String> organizationIds,
            List<String> tagKeys,
            List<String> tagKeyValues,
            List<String> directorySources,
            List<String> userLinks) {
        PinotQueryBuilder queryBuilder = new PinotQueryBuilder(devicesTable, tenantId)
                .selectCountAll();
        applyDeviceFilters(queryBuilder, statuses, connectivity, clientOutdated, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues,
                directorySources, userLinks, null);
        return executeCountQuery(queryBuilder.build());
    }

    /**
     * Executes a faceted filter-option query, counting every device except DELETED
     * (unless the caller explicitly requested DELETED in {@code statuses}):
     * SELECT {facetField}, COUNT(*) as count FROM devices WHERE <filters excluding facetField> GROUP BY {facetField} ORDER BY count DESC LIMIT {MAX_FILTER_OPTIONS}
     * The explicit LIMIT overrides Pinot's default GROUP BY cap of 10 groups so every bucket is returned.
     */
    private Map<String, Integer> executeFacetQuery(String facetField,
                                                    String tenantId,
                                                    List<String> statuses,
                                                    List<String> connectivity,
                                                    Boolean clientOutdated,
                                                    List<String> deviceTypes,
                                                    List<String> osTypes,
                                                    List<String> organizationIds,
                                                    List<String> tagKeys,
                                                    List<String> tagKeyValues,
                                                    List<String> directorySources,
                                                    List<String> userLinks,
                                                    String excludeField) {
        PinotQueryBuilder queryBuilder = newFacetQueryBuilder(facetField, tenantId);
        applyDeviceFilters(queryBuilder, statuses, connectivity, clientOutdated, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues,
                directorySources, userLinks, excludeField);
        return executeKeyCountQuery(queryBuilder.build());
    }

    /**
     * Same as {@link #executeFacetQuery} but counts only active devices (status ONLINE or OFFLINE).
     * Used by the organization device counts facet.
     */
    private Map<String, Integer> executeActiveFacetQuery(String facetField,
                                                         String tenantId,
                                                         List<String> statuses,
                                                         List<String> connectivity,
                                                         Boolean clientOutdated,
                                                         List<String> deviceTypes,
                                                         List<String> osTypes,
                                                         List<String> organizationIds,
                                                         List<String> tagKeys,
                                                         List<String> tagKeyValues,
                                                         List<String> directorySources,
                                                         List<String> userLinks,
                                                         String excludeField) {
        PinotQueryBuilder queryBuilder = newFacetQueryBuilder(facetField, tenantId);
        applyActiveDeviceFilters(queryBuilder, statuses, connectivity, clientOutdated, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues,
                directorySources, userLinks, excludeField);
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
     * Applies the shared device filter set to a builder. DELETED devices are excluded by default,
     * but a caller that explicitly lists DELETED in {@code statuses} opts into counting them
     * (archive page and dashboard archived-devices card); the lift applies to the facet queries too,
     * so the status facet can return a DELETED bucket.
     * If {@code excludeField} matches a filter's field, that filter is skipped (used for faceted filter-option queries).
     */
    private void applyDeviceFilters(PinotQueryBuilder queryBuilder,
                                    List<String> statuses,
                                    List<String> connectivity,
                                    Boolean clientOutdated,
                                    List<String> deviceTypes,
                                    List<String> osTypes,
                                    List<String> organizationIds,
                                    List<String> tagKeys,
                                    List<String> tagKeyValues,
                                    List<String> directorySources,
                                    List<String> userLinks,
                                    String excludeField) {
        List<String> requestedStatuses = sanitizeStatuses(statuses);
        if (!requestedStatuses.contains(DELETED.name())) {
            queryBuilder.whereNotEquals(STATUS, DELETED.name());
        }
        applyStatusFilter(queryBuilder, requestedStatuses, excludeField);
        applyConnectivityFilter(queryBuilder, connectivity, excludeField);
        applyClientOutdatedFilter(queryBuilder, clientOutdated);
        applyNonStatusFilters(queryBuilder, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues,
                directorySources, userLinks, excludeField);
    }

    /**
     * Applies the shared device filter set to a builder, restricting the counted universe to
     * active devices (status ONLINE or OFFLINE) instead of the default exclude-only-DELETED rule.
     * If {@code excludeField} matches a filter's field, that filter is skipped.
     */
    private void applyActiveDeviceFilters(PinotQueryBuilder queryBuilder,
                                          List<String> statuses,
                                          List<String> connectivity,
                                          Boolean clientOutdated,
                                          List<String> deviceTypes,
                                          List<String> osTypes,
                                          List<String> organizationIds,
                                          List<String> tagKeys,
                                          List<String> tagKeyValues,
                                          List<String> directorySources,
                                          List<String> userLinks,
                                          String excludeField) {
        queryBuilder.whereIn(STATUS, ACTIVE_STATUSES);
        applyStatusFilter(queryBuilder, sanitizeStatuses(statuses), excludeField);
        applyConnectivityFilter(queryBuilder, connectivity, excludeField);
        applyClientOutdatedFilter(queryBuilder, clientOutdated);
        applyNonStatusFilters(queryBuilder, deviceTypes, osTypes, organizationIds, tagKeys, tagKeyValues,
                directorySources, userLinks, excludeField);
    }

    private static List<String> sanitizeStatuses(List<String> statuses) {
        if (statuses == null) {
            return List.of();
        }
        return statuses.stream()
                .filter(status -> status != null && !status.isBlank())
                .toList();
    }

    /**
     * Applies the caller-supplied status filter verbatim. The base status restriction is applied
     * separately by the caller, so a selection with no overlap with the allowed universe becomes
     * a contradiction that correctly yields zero rows rather than broadening the query.
     * Skipped when status is the faceted field.
     */
    private void applyStatusFilter(PinotQueryBuilder queryBuilder,
                                   List<String> requestedStatuses,
                                   String excludeField) {
        if (STATUS.equals(excludeField) || requestedStatuses.isEmpty()) {
            return;
        }
        queryBuilder.whereOr(STATUS, requestedStatuses);
    }

    // Connectivity is the online/offline facet; skipped when it is the faceted field, like status.
    private void applyConnectivityFilter(PinotQueryBuilder queryBuilder,
                                         List<String> connectivity,
                                         String excludeField) {
        if (CONNECTIVITY.equals(excludeField) || connectivity == null || connectivity.isEmpty()) {
            return;
        }
        queryBuilder.whereOr(CONNECTIVITY, connectivity);
    }

    // A row without a known version holds the column default -1 (IS NULL kept for queries run with null handling on),
    // so it lands on the not-outdated side
    private void applyClientOutdatedFilter(PinotQueryBuilder queryBuilder, Boolean clientOutdated) {
        if (clientOutdated == null) {
            return;
        }
        long thresholdKey = clientVersionThreshold.getMinSupportedKey();
        String condition = clientOutdated
                ? OUTDATED_CONDITION.formatted(AGENT_VERSION_KEY, AGENT_VERSION_KEY, thresholdKey)
                : NOT_OUTDATED_CONDITION.formatted(AGENT_VERSION_KEY, AGENT_VERSION_KEY, thresholdKey, AGENT_VERSION_KEY);
        queryBuilder.where(condition);
    }

    private void applyNonStatusFilters(PinotQueryBuilder queryBuilder,
                                       List<String> deviceTypes,
                                       List<String> osTypes,
                                       List<String> organizationIds,
                                       List<String> tagKeys,
                                       List<String> tagKeyValues,
                                       List<String> directorySources,
                                       List<String> userLinks,
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

        // MV column: "directorySources = 'X'" holds when any of the machine's sources is X
        if (!DIRECTORY_SOURCES.equals(excludeField) && directorySources != null && !directorySources.isEmpty()) {
            queryBuilder.whereOr(DIRECTORY_SOURCES, directorySources);
        }

        if (!DIRECTORY_USER_LINK.equals(excludeField) && userLinks != null && !userLinks.isEmpty()) {
            queryBuilder.whereOr(DIRECTORY_USER_LINK, userLinks);
        }
    }
}
