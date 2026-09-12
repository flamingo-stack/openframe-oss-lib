package com.openframe.api.dto.organization;

import com.openframe.data.document.organization.Organization;

import java.time.Instant;

public final class OrganizationCursors {

    public static final String LAST_ACTIVITY_FIELD = "updatedAt";

    private static final String CURSOR_SEPARATOR = "_";

    private OrganizationCursors() {
    }

    public static String lastActivity(Organization org) {
        Instant value = org.getUpdatedAt() != null ? org.getUpdatedAt() : org.getCreatedAt();
        long millis = value != null ? value.toEpochMilli() : 0L;
        return encodeCompoundCursor(millis, org.getId());
    }

    /**
     * Builds a compound cursor of the shared `<epochMillis>_<id>` format used across
     * entity mappers (e.g. Organization, Log). Centralizing this here reduces the risk
     * of format drift between independent implementations.
     */
    public static String encodeCompoundCursor(long epochMillis, String id) {
        return epochMillis + CURSOR_SEPARATOR + id;
    }
}
