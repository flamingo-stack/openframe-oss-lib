package com.openframe.api.dto.audit;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents an organization filter option with ID and name
 * Used for organization dropdown in log filters
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrganizationFilterOption {

    private String id;
    private String name;

}