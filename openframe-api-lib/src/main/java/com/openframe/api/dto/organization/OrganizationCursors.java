package com.openframe.api.dto.organization;

import com.openframe.data.document.organization.Organization;
import com.openframe.data.repository.organization.OrganizationKeysetCursor;

public final class OrganizationCursors {

    public static final String LAST_ACTIVITY_FIELD = OrganizationKeysetCursor.UPDATED_AT_FIELD;

    private OrganizationCursors() {
    }

    public static String lastActivity(Organization org) {
        return forSort(org, LAST_ACTIVITY_FIELD);
    }

    public static String forSort(Organization org, String sortField) {
        return OrganizationKeysetCursor.encode(org, sortField);
    }
}
