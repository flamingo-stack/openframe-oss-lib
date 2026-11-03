package com.openframe.external.util;

import com.openframe.core.exception.ValidationException;

import java.util.List;

/**
 * Sort-field validation for the external API: an unknown field must fail loudly with 400 instead of
 * silently answering in the default order (an integration that misspells the field would never notice
 * it works with a different order than it asked for).
 */
public final class ExternalSorts {

    static final List<String> CUSTOMER_SORT_FIELDS = List.of("name", "createdAt", "updatedAt");

    private ExternalSorts() {
    }

    /** Null/blank means "default order"; a documented field is returned trimmed; anything else is a 400. */
    public static String requireCustomerSortField(String sortField) {
        if (sortField == null || sortField.trim().isEmpty()) {
            return null;
        }
        String trimmed = sortField.trim();
        if (!CUSTOMER_SORT_FIELDS.contains(trimmed)) {
            throw new ValidationException("Unknown sort field: " + trimmed, List.of(
                    new ValidationException.FieldError("sortField",
                            "must be one of: " + String.join(", ", CUSTOMER_SORT_FIELDS))));
        }
        return trimmed;
    }
}
