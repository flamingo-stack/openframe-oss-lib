package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.organization.OrganizationFilterInput;
import com.openframe.api.dto.organization.OrganizationFilterOptions;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.CursorPaginationInput;
import com.openframe.api.mapper.GraphQLOrganizationMapper;
import com.openframe.api.service.OrganizationQueryService;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.service.OrganizationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;

/**
 * GraphQL DataFetcher for Organization queries.
 */
@DgsComponent
@RequiredArgsConstructor
@Slf4j
@Validated
public class OrganizationDataFetcher {

    private final OrganizationService organizationService;
    private final OrganizationQueryService organizationQueryService;
    private final GraphQLOrganizationMapper mapper;

    @DgsQuery
    public CountedGenericConnection<GenericEdge<Organization>> organizations(
            @InputArgument @Valid OrganizationFilterInput filter,
            @InputArgument @Valid CursorPaginationInput pagination,
            @InputArgument String search) {

        log.debug("Getting organizations with filter: {}, pagination: {}, search: {}", filter, pagination, search);

        OrganizationFilterOptions filterOptions = mapper.toFilterOptions(filter);
        CursorPaginationCriteria paginationCriteria = mapper.toCursorPaginationCriteria(pagination);
        CountedGenericQueryResult<Organization> result = organizationQueryService.queryOrganizations(filterOptions, paginationCriteria, search);
        return mapper.toOrganizationConnection(result);
    }

    @DgsQuery
    public Organization organization(@InputArgument @NotBlank String id) {
        log.debug("Fetching organization by ID: {}", id);
        return organizationService.getOrganizationById(id).orElse(null);
    }

    @DgsQuery
    public Organization organizationByOrganizationId(@InputArgument @NotBlank String organizationId) {
        log.debug("Fetching organization by organizationId: {}", organizationId);
        return organizationService.getOrganizationByOrganizationId(organizationId).orElse(null);
    }
}
