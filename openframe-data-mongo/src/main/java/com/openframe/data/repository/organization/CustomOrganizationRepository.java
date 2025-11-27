package com.openframe.data.repository.organization;

import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.filter.OrganizationQueryFilter;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

/**
 * Custom repository interface for organization queries with filtering and pagination.
 */
public interface CustomOrganizationRepository {

    /**
     * Build MongoDB query with filters and search.
     */
    Query buildOrganizationQuery(OrganizationQueryFilter filter, String search);

    /**
     * Build MongoDB query with filters, search, and cursor for pagination.
     * @param filter Query filter criteria
     * @param search Search string
     * @param cursor Starting cursor for pagination (organization ID)
     * @return MongoDB query object
     */
    Query buildOrganizationQuery(OrganizationQueryFilter filter, String search, String cursor);

    /**
     * Find organizations with filters and search applied at database level.
     */
    List<Organization> findOrganizationsWithFilters(OrganizationQueryFilter filter, String search);

    /**
     * Find organizations with cursor-based pagination.
     * @param query MongoDB query with filters applied
     * @param cursor Starting cursor for pagination (organization ID)
     * @param limit Maximum number of organizations to return
     * @return List of organizations
     */
    List<Organization> findOrganizationsWithCursor(Query query, String cursor, int limit);
}
