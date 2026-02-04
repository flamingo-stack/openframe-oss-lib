package com.openframe.api.dto.shared;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * GraphQL input type for sorting query results
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SortInput {
    private String field;
    private SortDirection direction;
}