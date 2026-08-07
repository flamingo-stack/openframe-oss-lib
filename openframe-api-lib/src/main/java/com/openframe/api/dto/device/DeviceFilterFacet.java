package com.openframe.api.dto.device;

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
    FILTERED_COUNT("filteredCount");

    /** Every facet — the behaviour non-GraphQL callers (the external REST API) still want. */
    public static final Set<DeviceFilterFacet> ALL = EnumSet.allOf(DeviceFilterFacet.class);

    private final String graphQlField;

    DeviceFilterFacet(String graphQlField) {
        this.graphQlField = graphQlField;
    }

    public String graphQlField() {
        return graphQlField;
    }
}
