package com.openframe.api.service;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.organization.OrganizationFilterOptions;
import com.openframe.api.dto.organization.OrganizationList;
import com.openframe.api.dto.shared.CursorPageInfo;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.filter.OrganizationQueryFilter;
import com.openframe.data.repository.organization.OrganizationRepository;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Service for querying organizations with filtering and search.
 * Follows ToolService pattern - filtering at MongoDB level.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrganizationQueryService {

    private final OrganizationRepository organizationRepository;

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
        
        List<Organization> pageItems = fetchPageItems(query, normalizedPagination, sortField, sortDirection);
        boolean hasNextPage = pageItems.size() == normalizedPagination.getLimit();

        CursorPageInfo pageInfo = buildPageInfo(pageItems, hasNextPage, normalizedPagination.hasCursor());

        return CountedGenericQueryResult.<Organization>builder()
                .items(pageItems)
                .pageInfo(pageInfo)
                .filteredCount(pageItems.size())
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

    private CursorPageInfo buildPageInfo(List<Organization> pageItems, boolean hasNextPage, boolean hasPreviousPage) {
        String startCursor = pageItems.isEmpty() ? null : pageItems.getFirst().getId();
        String endCursor = pageItems.isEmpty() ? null : pageItems.getLast().getId();

        return CursorPageInfo.builder()
                .hasNextPage(hasNextPage)
                .hasPreviousPage(hasPreviousPage)
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
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
