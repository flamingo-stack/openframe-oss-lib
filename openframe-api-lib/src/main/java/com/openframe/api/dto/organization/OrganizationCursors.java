package com.openframe.api.dto.organization;

import com.openframe.data.document.organization.Organization;

import java.time.Instant;

public final class OrganizationCursors {

    public static final String LAST_ACTIVITY_FIELD = "updatedAt";

    private OrganizationCursors() {
    }

    public static String lastActivity(Organization org) {
        Instant value = org.getUpdatedAt() != null ? org.getUpdatedAt() : org.getCreatedAt();
        long millis = value != null ? value.toEpochMilli() : 0L;
        return millis + "_" + org.getId();
    }
}
