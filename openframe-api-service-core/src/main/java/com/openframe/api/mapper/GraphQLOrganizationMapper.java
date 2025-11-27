package com.openframe.api.mapper;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.organization.OrganizationFilterInput;
import com.openframe.api.dto.organization.OrganizationFilterOptions;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.CursorPaginationInput;
import com.openframe.data.document.organization.Organization;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Mapper for converting GraphQL organization inputs to internal DTOs.
 */
@Component
public class GraphQLOrganizationMapper {

    /**
     * Convert GraphQL filter input to internal filter options.
     */
    public OrganizationFilterOptions toFilterOptions(OrganizationFilterInput input) {
        if (input == null) {
            return null;
        }

        return OrganizationFilterOptions.builder()
                .category(input.getCategory())
                .minEmployees(input.getMinEmployees())
                .maxEmployees(input.getMaxEmployees())
                .hasActiveContract(input.getHasActiveContract())
                .build();
    }

    /**
     * Convert GraphQL pagination input to internal pagination criteria.
     */
    public CursorPaginationCriteria toCursorPaginationCriteria(CursorPaginationInput input) {
        if (input == null) {
            return new CursorPaginationCriteria();
        }

        return CursorPaginationCriteria.builder()
                .limit(input.getLimit())
                .cursor(input.getCursor())
                .build();
    }

    /**
     * Convert organization query result to GraphQL connection.
     */
    public CountedGenericConnection<GenericEdge<Organization>> toOrganizationConnection(CountedGenericQueryResult<Organization> result) {
        List<GenericEdge<Organization>> edges = result.getItems().stream()
                .map(organization -> GenericEdge.<Organization>builder()
                        .node(organization)
                        .cursor(organization.getId())
                        .build())
                .collect(Collectors.toList());

        return CountedGenericConnection.<GenericEdge<Organization>>builder()
                .edges(edges)
                .pageInfo(result.getPageInfo())
                .filteredCount(result.getFilteredCount())
                .build();
    }
}
