package com.openframe.api.dto.organization;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateOrganizationStatusRequest {

    @NotNull(message = "Status is required")
    private OrganizationStatusAction status;

    /**
     * Allowed status transitions for organization.
     * Only ARCHIVED and ACTIVE are allowed via API — DELETED is not supported.
     */
    public enum OrganizationStatusAction {
        ARCHIVED,
        ACTIVE
    }
}
