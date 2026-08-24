package com.openframe.api.service;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.organization.OrganizationCursors;
import com.openframe.api.dto.organization.OrganizationFilterOptions;
import com.openframe.api.dto.organization.OrganizationList;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.exception.OrganizationNotFoundException;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.filter.OrganizationQueryFilter;
import com.openframe.data.repository.organization.OrganizationRepository;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * Service for querying organizations with filtering and search.
 * Follows ToolService pattern - filtering at MongoDB level.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrganizationQueryService {

    private final OrganizationRepository organizationRepository;

    public boolean hasOrganization(String organizationId) {
        return organizationRepository.findByOrganizationId(organizationId).isPresent();
    }

    public Organization getOrganization(String organizationId) {
        return organizationRepository.findByOrganizationId(organizationId)
                .orElseThrow(() -> new OrganizationNotFoundException(organizationId));
    }

    /**
     * Query organizations with optional filtering, pagination, and search.
     * Filtering happens at MongoDB level for better performance.
     */
    public CountedGenericQueryResult<Organization> queryOrganizations(
            OrganizationFilterOptions filterOptions,
            CursorPaginationCriteria paginationCriteria,
            String search,
            SortInput sort) {

        log.debug("Querying organizations with filter: {}, pagination: {}, search: {}, sort: {}",
                filterOptions, paginationCriteria, search, sort);

        CursorPaginationCriteria normalizedPagination = paginationCriteria.normalize();
        OrganizationQueryFilter queryFilter = buildQueryFilter(filterOptions);
        Query query = organizationRepository.buildOrganizationQuery(queryFilter, search);
        String sortField = validateSortField(sort != null ? sort.getField() : null);
        SortDirection sortDirection = (sort != null && sort.getDirection() != null) ?
            sort.getDirection() : SortDirection.DESC;

        // Total number of documents matching the filter + search, across all
        // pages. Must be computed on the base query BEFORE fetchPageItems
        // mutates it with the cursor keyset and limit.
        long filteredCount = organizationRepository.countOrganizations(query);

        List<Organization> pageItems = fetchPageItems(query, normalizedPagination, sortField, sortDirection);
        boolean hasNextPage = pageItems.size() == normalizedPagination.getLimit();
        boolean hasPreviousPage = normalizedPagination.hasCursor();

        PageInfo pageInfo = buildPageInfo(pageItems, hasNextPage, hasPreviousPage, sortField);

        return CountedGenericQueryResult.<Organization>builder()
                .items(pageItems)
                .pageInfo(pageInfo)
                .filteredCount((int) filteredCount)
                .build();
    }

    private List<Organization> fetchPageItems(@NotNull Query query, CursorPaginationCriteria criteria,
                                               String sortField, SortDirection sortDirection) {
        List<Organization> organizations = organizationRepository.findOrganizationsWithCursor(
            query, criteria.getCursor(), criteria.getLimit() + 1, sortField, sortDirection.name());
        return organizations.size() > criteria.getLimit()
            ? organizations.subList(0, criteria.getLimit())
            : organizations;
    }

    private PageInfo buildPageInfo(List<Organization> pageItems, boolean hasNextPage, boolean hasPreviousPage,
                                   String sortField) {
        String startCursor = null;
        String endCursor = null;
        if (!pageItems.isEmpty()) {
            Organization firstOrganization = pageItems.getFirst();
            String firstCursorRaw = rawCursor(firstOrganization, sortField);
            startCursor = CursorCodec.encode(firstCursorRaw);

            Organization lastOrganization = pageItems.getLast();
            String lastCursorRaw = rawCursor(lastOrganization, sortField);
            endCursor = CursorCodec.encode(lastCursorRaw);
        }

        return PageInfo.builder()
                .hasNextPage(hasNextPage)
                .hasPreviousPage(hasPreviousPage)
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
    }

    /**
     * Raw cursor value for an organization, matching the active sort. Sorting by
     * last activity uses a compound {@code (lastActivityAt, _id)} keyset; any
     * other sort (e.g. the legacy {@code _id} default used by the REST surface)
     * keeps the plain ObjectId cursor.
     */
    private String rawCursor(Organization org, String sortField) {
        if (OrganizationCursors.LAST_ACTIVITY_FIELD.equals(sortField)) {
            return OrganizationCursors.lastActivity(org);
        }
        return org.getId();
    }

    /**
     * Build MongoDB query filter from filter options.
     */
    private OrganizationQueryFilter buildQueryFilter(OrganizationFilterOptions filterOptions) {
        if (filterOptions == null) {
            return OrganizationQueryFilter.builder().build();
        }

        return OrganizationQueryFilter.builder()
                .category(filterOptions.getCategory())
                .minEmployees(filterOptions.getMinEmployees())
                .maxEmployees(filterOptions.getMaxEmployees())
                .hasActiveContract(filterOptions.getHasActiveContract())
                .status(filterOptions.getStatus())
                .lastActivityFrom(filterOptions.getLastActivityFrom())
                .lastActivityTo(filterOptions.getLastActivityTo())
                .build();
    }
    
    private String validateSortField(String field) {
        if (field == null || field.trim().isEmpty()) {
            return organizationRepository.getDefaultSortField();
        }
        String trimmedField = field.trim();
        if (!organizationRepository.isSortableField(trimmedField)) {
            log.warn("Invalid sort field requested for organizations: {}, using default", field);
            return organizationRepository.getDefaultSortField();
        }
        return trimmedField;
    }
}
