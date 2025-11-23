package com.openframe.api.mapper;

import com.openframe.api.dto.organization.OrganizationConnection;
import com.openframe.api.dto.organization.OrganizationEdge;
import com.openframe.api.dto.organization.OrganizationFilterInput;
import com.openframe.api.dto.organization.OrganizationFilterOptions;
import com.openframe.api.dto.organization.OrganizationQueryResult;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.CursorPaginationInput;
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
    public OrganizationConnection toOrganizationConnection(OrganizationQueryResult result) {
        List<OrganizationEdge> edges = result.getOrganizations().stream()
                .map(organization -> OrganizationEdge.builder()
                        .node(organization)
                        .cursor(organization.getId())
                        .build())
                .collect(Collectors.toList());

        return OrganizationConnection.builder()
                .edges(edges)
                .pageInfo(result.getPageInfo())
                .filteredCount(result.getFilteredCount())
                .build();
    }
}
