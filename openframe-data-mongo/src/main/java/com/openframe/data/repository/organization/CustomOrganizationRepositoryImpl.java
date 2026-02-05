package com.openframe.data.repository.organization;

import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.filter.OrganizationQueryFilter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Custom repository implementation for organization queries with MongoDB filtering.
 * Performs filtering at database level for better performance.
 */
@Repository
@RequiredArgsConstructor
@Slf4j
public class CustomOrganizationRepositoryImpl implements CustomOrganizationRepository {

    private static final String SORT_DESC = "DESC";
    private static final String ID_FIELD = "_id";
    
    private static final List<String> SORTABLE_FIELDS = List.of(
            "_id",
            "name",
            "organizationId",
            "createdAt",
            "updatedAt"
    );
    private static final String DEFAULT_SORT_FIELD = "_id";

    private final MongoTemplate mongoTemplate;

    @Override
    public Query buildOrganizationQuery(OrganizationQueryFilter filter, String search) {
        Query query = new Query();
        
        // Collect all criteria to combine them with $and
        List<Criteria> criteriaList = new ArrayList<>();

        // Always exclude soft deleted organizations
        criteriaList.add(new Criteria().orOperator(
                Criteria.where("deleted").is(false),
                Criteria.where("deleted").exists(false)
        ));

        if (filter != null) {
            // Category filter
            if (filter.getCategory() != null) {
                criteriaList.add(Criteria.where("category").regex("^" + filter.getCategory() + "$", "i"));
            }

            // Employee range filters
            if (filter.getMinEmployees() != null) {
                criteriaList.add(Criteria.where("numberOfEmployees").gte(filter.getMinEmployees()));
            }

            if (filter.getMaxEmployees() != null) {
                criteriaList.add(Criteria.where("numberOfEmployees").lte(filter.getMaxEmployees()));
            }

            // Active contract filter
            if (filter.getHasActiveContract() != null && filter.getHasActiveContract()) {
                LocalDate now = LocalDate.now();
                criteriaList.add(new Criteria().andOperator(
                        Criteria.where("contractStartDate").ne(null).lte(now),
                        Criteria.where("contractEndDate").ne(null).gte(now)
                ));
            } else if (filter.getHasActiveContract() != null && !filter.getHasActiveContract()) {
                LocalDate now = LocalDate.now();
                criteriaList.add(new Criteria().orOperator(
                        Criteria.where("contractStartDate").is(null),
                        Criteria.where("contractEndDate").is(null),
                        Criteria.where("contractStartDate").gt(now),
                        Criteria.where("contractEndDate").lt(now)
                ));
            }
        }

        // Search filter (name, organizationId or category)
        if (search != null && !search.trim().isEmpty()) {
            criteriaList.add(new Criteria().orOperator(
                    Criteria.where("name").regex(search, "i"),
                    Criteria.where("organizationId").regex(search, "i"),
                    Criteria.where("category").regex(search, "i")
            ));
        }

        // Combine all criteria with $and in a single addCriteria call
        if (!criteriaList.isEmpty()) {
            query.addCriteria(new Criteria().andOperator(
                    criteriaList.toArray(new Criteria[0])
            ));
        }

        return query;
    }

    @Override
    public List<Organization> findOrganizationsWithFilters(OrganizationQueryFilter filter, String search) {
        Query query = buildOrganizationQuery(filter, search);

        log.debug("Executing MongoDB query: {}", query);
        return mongoTemplate.find(query, Organization.class);
    }

    @Override
    public List<Organization> findOrganizationsWithCursor(Query query, String cursor, int limit, 
                                                          String sortField, String sortDirection) {
        if (cursor != null && !cursor.trim().isEmpty()) {
            try {
                ObjectId cursorId = new ObjectId(cursor);
                query.addCriteria(Criteria.where(ID_FIELD).lt(cursorId));
            } catch (IllegalArgumentException ex) {
                log.warn("Invalid ObjectId cursor format: {}", cursor);
            }
        }
        
        query.limit(limit);
        
        Sort.Direction mongoSortDirection = SORT_DESC.equalsIgnoreCase(sortDirection) ? 
            Sort.Direction.DESC : Sort.Direction.ASC;
            
        if (ID_FIELD.equals(sortField)) {
            query.with(Sort.by(mongoSortDirection, ID_FIELD));
        } else {
            query.with(Sort.by(
                Sort.Order.by(sortField).with(mongoSortDirection),
                Sort.Order.by(ID_FIELD).with(mongoSortDirection)
            ));
        }

        log.debug("Executing MongoDB query with cursor pagination: {}", query);
        return mongoTemplate.find(query, Organization.class);
    }
    
    @Override
    public boolean isSortableField(String field) {
        return field != null && SORTABLE_FIELDS.contains(field.trim());
    }
    
    @Override
    public String getDefaultSortField() {
        return DEFAULT_SORT_FIELD;
    }
}
