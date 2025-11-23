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
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

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
        Query query = new Query();

        if (filter != null) {
            // Category filter
            if (filter.getCategory() != null) {
                query.addCriteria(Criteria.where("category").regex("^" + filter.getCategory() + "$", "i"));
            }

            // Employee range filters
            if (filter.getMinEmployees() != null) {
                query.addCriteria(Criteria.where("numberOfEmployees").gte(filter.getMinEmployees()));
            }

            if (filter.getMaxEmployees() != null) {
                query.addCriteria(Criteria.where("numberOfEmployees").lte(filter.getMaxEmployees()));
            }

            // Active contract filter
            if (filter.getHasActiveContract() != null && filter.getHasActiveContract()) {
                LocalDate now = LocalDate.now();
                query.addCriteria(new Criteria().andOperator(
                        Criteria.where("contractStartDate").ne(null).lte(now),
                        Criteria.where("contractEndDate").ne(null).gte(now)
                ));
            } else if (filter.getHasActiveContract() != null && !filter.getHasActiveContract()) {
                LocalDate now = LocalDate.now();
                query.addCriteria(new Criteria().orOperator(
                        Criteria.where("contractStartDate").is(null),
                        Criteria.where("contractEndDate").is(null),
                        Criteria.where("contractStartDate").gt(now),
                        Criteria.where("contractEndDate").lt(now)
                ));
            }
        }

        // Search filter (name or category)
        if (search != null && !search.trim().isEmpty()) {
            Criteria searchCriteria = new Criteria().orOperator(
                    Criteria.where("name").regex(search, "i"),
                    Criteria.where("category").regex(search, "i")
            );
            query.addCriteria(searchCriteria);
        }

        return query;
    }

    @Override
    public List<Organization> findOrganizationsWithFilters(OrganizationQueryFilter filter, String search) {
        Query query = buildOrganizationQuery(filter, search);

        // Always exclude soft deleted organizations
        query.addCriteria(new Criteria().orOperator(
                Criteria.where("deleted").is(false),
                Criteria.where("deleted").exists(false)
        ));

        log.debug("Executing MongoDB query: {}", query);
        return mongoTemplate.find(query, Organization.class);
    }

    @Override
    public List<Organization> findOrganizationsWithCursor(Query query, String cursor, int limit) {
        // Always exclude soft deleted organizations
        query.addCriteria(new Criteria().orOperator(
                Criteria.where("deleted").is(false),
                Criteria.where("deleted").exists(false)
        ));

        if (cursor != null && !cursor.trim().isEmpty()) {
            try {
                ObjectId cursorId = new ObjectId(cursor);
                query.addCriteria(Criteria.where("_id").lt(cursorId));
            } catch (IllegalArgumentException ex) {
                log.warn("Invalid ObjectId cursor format: {}", cursor);
            }
        }

        query.limit(limit);
        query.with(Sort.by(Sort.Direction.DESC, "_id"));

        log.debug("Executing MongoDB query with cursor pagination: {}", query);
        return mongoTemplate.find(query, Organization.class);
    }
}
