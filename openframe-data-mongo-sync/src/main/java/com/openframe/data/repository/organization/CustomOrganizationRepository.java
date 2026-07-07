package com.openframe.data.repository.organization;

import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.filter.OrganizationQueryFilter;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

public interface CustomOrganizationRepository {

    Query buildOrganizationQuery(OrganizationQueryFilter filter, String search);

    List<Organization> findOrganizationsWithFilters(OrganizationQueryFilter filter, String search);

    List<Organization> findOrganizationsWithCursor(Query query, String cursor, int limit,
                                                   String sortField, String sortDirection);

    /**
     * Count all documents matching the given query, ignoring pagination. The
     * query must be the base filter/search query, before any cursor keyset or
     * limit has been applied.
     */
    long countOrganizations(Query query);

    boolean isSortableField(String field);
    
    String getDefaultSortField();
}
