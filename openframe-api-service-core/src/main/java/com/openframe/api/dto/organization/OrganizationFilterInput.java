package com.openframe.api.dto.organization;

import lombok.Data;

/**
 * GraphQL input type for organization filtering.
 * Maps to OrganizationFilterInput from GraphQL schema.
 */
@Data
public class OrganizationFilterInput {
    private String category;
    private Integer minEmployees;
    private Integer maxEmployees;
    private Boolean hasActiveContract;
}
