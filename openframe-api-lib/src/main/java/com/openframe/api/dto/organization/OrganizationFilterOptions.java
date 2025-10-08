package com.openframe.api.dto.organization;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Internal DTO for organization filter options.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrganizationFilterOptions {
    private String category;
    private Integer minEmployees;
    private Integer maxEmployees;
    private Boolean hasActiveContract;
}
