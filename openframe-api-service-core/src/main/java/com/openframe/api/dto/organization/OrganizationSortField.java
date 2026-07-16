package com.openframe.api.dto.organization;

/**
 * Sortable fields for the {@code organizations} query. Currently only the
 * canonical last-activity timestamp is sortable; the enum keeps the GraphQL
 * surface typed and future-proof.
 */
public enum OrganizationSortField {
    LAST_ACTIVITY
}
