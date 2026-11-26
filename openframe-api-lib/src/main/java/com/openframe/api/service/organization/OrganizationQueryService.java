package com.openframe.api.service.organization;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.organization.OrganizationCursors;
import com.openframe.api.dto.organization.OrganizationFilterOptions;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPage;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.filter.OrganizationQueryFilter;
import com.openframe.data.repository.organization.OrganizationRepository;
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

    public Optional<Organization> findByOrganizationId(String organizationId) {
        return organizationRepository.findByOrganizationId(organizationId);
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
        // pages. Must be computed on the base query BEFORE findOrganizationsWithCursor
        // mutates it with the cursor keyset and limit.
        long filteredCount = organizationRepository.countOrganizations(query);

        int limit = normalizedPagination.getLimit();
        boolean backward = normalizedPagination.isBackward();
        // A backward page (last/before) is the forward page in the opposite direction, read back in the requested order.
        SortDirection fetchDirection = backward ? sortDirection.opposite() : sortDirection;
        List<Organization> fetched = organizationRepository.findOrganizationsWithCursor(
            query, normalizedPagination.getCursor(), limit + 1, sortField, fetchDirection.name());
        CursorPage<Organization> page = CursorPage.assemble(fetched, normalizedPagination);
        List<Organization> pageItems = page.items();

        PageInfo pageInfo = buildPageInfo(page, sortField);

        return CountedGenericQueryResult.<Organization>builder()
                .items(pageItems)
                .pageInfo(pageInfo)
                .filteredCount((int) filteredCount)
                .build();
    }

    private PageInfo buildPageInfo(CursorPage<Organization> page, String sortField) {
        List<Organization> pageItems = page.items();
        String startCursor = pageItems.isEmpty() ? null : CursorCodec.encode(rawCursor(pageItems.getFirst(), sortField));
        String endCursor = pageItems.isEmpty() ? null : CursorCodec.encode(rawCursor(pageItems.getLast(), sortField));

        return PageInfo.builder()
                .hasNextPage(page.hasNextPage())
                .hasPreviousPage(page.hasPreviousPage())
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
    }

    private String rawCursor(Organization org, String sortField) {
        return OrganizationCursors.forSort(org, sortField);
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
                .excludeOrganizationIds(filterOptions.getExcludeOrganizationIds())
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
