package com.openframe.api.dto.organization;

import lombok.Data;

import java.time.Instant;

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
    private String status;
    /** Inclusive lower bound of the last-activity range (UTC). */
    private Instant lastActivityFrom;
    /** Inclusive upper bound of the last-activity range (UTC). */
    private Instant lastActivityTo;
}
