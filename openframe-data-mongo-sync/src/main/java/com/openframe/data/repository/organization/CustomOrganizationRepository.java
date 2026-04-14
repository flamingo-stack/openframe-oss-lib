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
    
    boolean isSortableField(String field);
    
    String getDefaultSortField();
}
