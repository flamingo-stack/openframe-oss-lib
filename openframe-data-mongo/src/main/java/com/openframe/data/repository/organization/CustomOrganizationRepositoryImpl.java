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

    private final MongoTemplate mongoTemplate;

    @Override
    public Query buildOrganizationQuery(OrganizationQueryFilter filter, String search) {
        return buildOrganizationQuery(filter, search, null);
    }
    
    @Override
    public Query buildOrganizationQuery(OrganizationQueryFilter filter, String search, String cursor) {
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
        
        // Cursor filter for pagination
        if (cursor != null && !cursor.trim().isEmpty()) {
            try {
                ObjectId cursorId = new ObjectId(cursor);
                criteriaList.add(Criteria.where("_id").lt(cursorId));
            } catch (IllegalArgumentException ex) {
                log.warn("Invalid ObjectId cursor format: {}", cursor);
            }
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
    public List<Organization> findOrganizationsWithCursor(Query query, String cursor, int limit) {
        // Note: The cursor is already included in the query via buildOrganizationQuery(filter, search, cursor)
        // This method just adds limit and sorting
        
        query.limit(limit);
        query.with(Sort.by(Sort.Direction.DESC, "_id"));

        log.debug("Executing MongoDB query with cursor pagination: {}", query);
        return mongoTemplate.find(query, Organization.class);
    }
}
