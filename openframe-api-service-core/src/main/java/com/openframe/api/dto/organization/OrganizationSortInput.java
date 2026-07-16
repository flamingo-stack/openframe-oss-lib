package com.openframe.api.dto.organization;

import com.openframe.api.dto.shared.SortDirection;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Typed sort input for the {@code organizations} query. Constrains the sortable
 * field to {@link OrganizationSortField} so clients can only request supported
 * orderings.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrganizationSortInput {

    private OrganizationSortField field;

    private SortDirection direction;
}
