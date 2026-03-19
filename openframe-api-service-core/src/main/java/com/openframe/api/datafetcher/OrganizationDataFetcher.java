package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.*;
import graphql.relay.Relay;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.organization.OrganizationFilterInput;
import com.openframe.api.dto.organization.OrganizationFilterOptions;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.SortInput;
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

    private static final Relay RELAY = new Relay();

    private final OrganizationService organizationService;
    private final OrganizationQueryService organizationQueryService;
    private final GraphQLOrganizationMapper mapper;

    @DgsData(parentType = "Organization", field = "id")
    public String organizationNodeId(DgsDataFetchingEnvironment dfe) {
        Organization org = dfe.getSource();
        return RELAY.toGlobalId("Organization", org.getOrganizationId());
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<Organization>> organizations(
            @InputArgument @Valid OrganizationFilterInput filter,
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before,
            @InputArgument String search,
            @InputArgument @Valid SortInput sort) {

        log.debug("Getting organizations with filter: {}, first: {}, after: {}, last: {}, before: {}, search: {}, sort: {}",
                filter, first, after, last, before, search, sort);

        OrganizationFilterOptions filterOptions = mapper.toFilterOptions(filter);
        ConnectionArgs connectionArgs = ConnectionArgs.builder().first(first).after(after).last(last).before(before).build();
        CursorPaginationCriteria paginationCriteria = mapper.toCursorPaginationCriteria(connectionArgs);
        CountedGenericQueryResult<Organization> result = organizationQueryService.queryOrganizations(
                filterOptions, paginationCriteria, search, sort);
        return mapper.toOrganizationConnection(result);
    }

    @DgsQuery
    public Organization organization(@InputArgument @NotBlank String id) {
        String organizationId = RELAY.fromGlobalId(id).getId();
        log.debug("Fetching organization by global ID: {}, organizationId: {}", id, organizationId);
        return organizationService.getOrganizationByOrganizationId(organizationId).orElse(null);
    }

    @DgsQuery
    public Organization organizationByOrganizationId(@InputArgument @NotBlank String organizationId) {
        log.debug("Fetching organization by organizationId: {}", organizationId);
        return organizationService.getOrganizationByOrganizationId(organizationId).orElse(null);
    }
}
