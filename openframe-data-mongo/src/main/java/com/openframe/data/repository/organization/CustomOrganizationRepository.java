package com.openframe.data.repository.organization;

import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.filter.OrganizationQueryFilter;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

/**
 * Custom repository interface for organization queries with filtering.
 */
public interface CustomOrganizationRepository {
    
    /**
     * Build MongoDB query with filters and search.
     */
    Query buildOrganizationQuery(OrganizationQueryFilter filter, String search);
    
    /**
     * Find organizations with filters and search applied at database level.
     */
    List<Organization> findOrganizationsWithFilters(OrganizationQueryFilter filter, String search);
}
