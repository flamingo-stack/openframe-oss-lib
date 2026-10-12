package com.openframe.api.dto.organization;

import jakarta.validation.constraints.NotNull;

public record UpdateOrganizationStatusRequest(
        @NotNull(message = "Status is required")
        OrganizationStatusAction status
) {

    // Only ARCHIVED and ACTIVE are allowed via API — DELETED is not supported.
    public enum OrganizationStatusAction {
        ARCHIVED,
        ACTIVE
    }
}
