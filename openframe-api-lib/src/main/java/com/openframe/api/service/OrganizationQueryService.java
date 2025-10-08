package com.openframe.api.service;

import com.openframe.api.dto.organization.OrganizationFilterOptions;
import com.openframe.api.dto.organization.OrganizationList;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.filter.OrganizationQueryFilter;
import com.openframe.data.repository.organization.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
     * Query organizations with optional filtering and search.
     * Filtering happens at MongoDB level for better performance.
     */
    public OrganizationList queryOrganizations(OrganizationFilterOptions filterOptions, String search) {
        log.debug("Querying organizations with filter: {}, search: {}", filterOptions, search);

        OrganizationQueryFilter queryFilter = buildQueryFilter(filterOptions);
        List<Organization> organizations = organizationRepository.findOrganizationsWithFilters(queryFilter, search);

        return OrganizationList.builder()
                .organizations(organizations)
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
}
