package com.openframe.data.document.organization.filter;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Filter criteria for organization queries.
 * Used to build MongoDB queries with filtering.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrganizationQueryFilter {
    private String category;
    private Integer minEmployees;
    private Integer maxEmployees;
    private Boolean hasActiveContract;
}
