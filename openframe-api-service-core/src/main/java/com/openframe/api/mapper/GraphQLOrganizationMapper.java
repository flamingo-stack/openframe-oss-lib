package com.openframe.api.mapper;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.organization.OrganizationCursors;
import com.openframe.api.dto.organization.OrganizationFilterInput;
import com.openframe.api.dto.organization.OrganizationFilterOptions;
import com.openframe.api.dto.organization.OrganizationSortInput;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.data.document.organization.Organization;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Mapper for converting GraphQL organization inputs to internal DTOs.
 */
@Component
public class GraphQLOrganizationMapper {

    public OrganizationFilterOptions toFilterOptions(OrganizationFilterInput input) {
        if (input == null) {
            return null;
        }

        return OrganizationFilterOptions.builder()
                .category(input.getCategory())
                .minEmployees(input.getMinEmployees())
                .maxEmployees(input.getMaxEmployees())
                .hasActiveContract(input.getHasActiveContract())
                .status(input.getStatus())
                .lastActivityFrom(input.getLastActivityFrom())
                .lastActivityTo(input.getLastActivityTo())
                .build();
    }

    public CursorPaginationCriteria toCursorPaginationCriteria(ConnectionArgs args) {
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    // No sort provided defaults to LAST_ACTIVITY DESC per spec.
    public SortInput toSortInput(OrganizationSortInput orderBy) {
        SortDirection direction = (orderBy != null && orderBy.getDirection() != null)
                ? orderBy.getDirection()
                : SortDirection.DESC;
        return SortInput.builder()
                .field(OrganizationCursors.LAST_ACTIVITY_FIELD)
                .direction(direction)
                .build();
    }

    public CountedGenericConnection<GenericEdge<Organization>> toOrganizationConnection(CountedGenericQueryResult<Organization> result) {
        // The organizations query always sorts by last activity, so per-edge
        // cursors use the compound (lastActivityAt, _id) keyset — consistent
        // with the page-info cursors built in OrganizationQueryService.
        List<GenericEdge<Organization>> edges = result.getItems().stream()
                .map(organization -> GenericEdge.<Organization>builder()
                        .node(organization)
                        .cursor(CursorCodec.encode(OrganizationCursors.lastActivity(organization)))
                        .build())
                .collect(Collectors.toList());

        return CountedGenericConnection.<GenericEdge<Organization>>builder()
                .edges(edges)
                .pageInfo(result.getPageInfo())
                .filteredCount(result.getFilteredCount())
                .build();
    }
}

