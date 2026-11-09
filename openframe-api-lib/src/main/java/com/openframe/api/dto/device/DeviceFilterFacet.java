package com.openframe.api.dto.device;

import java.util.Collections;
import java.util.EnumSet;
import java.util.Set;

/**
 * One independently-computed piece of {@link DeviceFilters}.
 *
 * Every facet costs its own Pinot round trip, so a caller that needs one number should not
 * pay for six. {@code DeviceFilterService} takes a set of these and skips the queries for
 * everything outside it; the GraphQL data fetcher derives the set from the selection set, so
 * {@code deviceFilters { filteredCount }} runs ONE query instead of six.
 *
 * {@link #graphQlField()} is the field name in the {@code DeviceFilters} GraphQL type and must
 * stay in sync with {@code device.graphqls} — it is what the selection-set lookup matches on.
 */
public enum DeviceFilterFacet {

    STATUSES("statuses"),
    DEVICE_TYPES("deviceTypes"),
    OS_TYPES("osTypes"),
    ORGANIZATION_IDS("organizationIds"),
    TAG_KEYS("tagKeys"),
    DIRECTORY_SOURCES("directorySources"),
    USER_LINKS("userLinks"),
    FILTERED_COUNT("filteredCount");

    /**
     * Every facet, the directory ones included. For a caller that has no selection set to narrow
     * it and whose response can carry all of them. A caller whose response does not expose a
     * facet must not use this: each unused facet is a Pinot round trip made for nothing.
     */
    public static final Set<DeviceFilterFacet> ALL =
            Collections.unmodifiableSet(EnumSet.allOf(DeviceFilterFacet.class));

    /**
     * What the external REST {@code /filters} response carries: everything except the directory
     * facets ({@link #DIRECTORY_SOURCES}, {@link #USER_LINKS}), which its DTO does not expose.
     * Listed explicitly so a facet added later stays off the REST path until the DTO exposes it.
     */
    public static final Set<DeviceFilterFacet> REST =
            Collections.unmodifiableSet(EnumSet.of(
                    STATUSES, DEVICE_TYPES, OS_TYPES, ORGANIZATION_IDS, TAG_KEYS, FILTERED_COUNT));

    private final String graphQlField;

    DeviceFilterFacet(String graphQlField) {
        this.graphQlField = graphQlField;
    }

    public String graphQlField() {
        return graphQlField;
    }
}
