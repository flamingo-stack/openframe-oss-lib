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
import java.util.Set;
import java.util.regex.Pattern;

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
    private static final String UPDATED_AT_FIELD = "updatedAt";
    private static final String ORGANIZATION_ID_FIELD = "organizationId";
    
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

        if (filter != null) {
            // Status filter (defaults to ACTIVE if not specified)
            if (filter.getStatus() != null) {
                criteriaList.add(Criteria.where("status").is(filter.getStatus()));
            } else {
                criteriaList.add(new Criteria().orOperator(
                        Criteria.where("status").is("ACTIVE"),
                        Criteria.where("status").exists(false)
                ));
            }

            // Category filter
            if (filter.getCategory() != null) {
                criteriaList.add(Criteria.where("category")
                        .regex("^" + Pattern.quote(filter.getCategory()) + "$", "i"));
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

            // Last-activity range filter (inclusive, independent bounds).
            // Operates on updatedAt, which backs the lastActivityAt field.
            if (filter.getLastActivityFrom() != null) {
                criteriaList.add(Criteria.where(UPDATED_AT_FIELD).gte(filter.getLastActivityFrom()));
            }
            if (filter.getLastActivityTo() != null) {
                criteriaList.add(Criteria.where(UPDATED_AT_FIELD).lte(filter.getLastActivityTo()));
            }

            Set<String> excludedOrganizationIds = filter.getExcludeOrganizationIds();
            if (excludedOrganizationIds != null && !excludedOrganizationIds.isEmpty()) {
                criteriaList.add(Criteria.where(ORGANIZATION_ID_FIELD).nin(excludedOrganizationIds));
            }
        } else {
            // No filter provided — default to ACTIVE status
            criteriaList.add(new Criteria().orOperator(
                    Criteria.where("status").is("ACTIVE"),
                    Criteria.where("status").exists(false)
            ));
        }

        // Search filter (name, organizationId or category)
        if (search != null && !search.trim().isEmpty()) {
            String quoted = Pattern.quote(search);
            criteriaList.add(new Criteria().orOperator(
                    Criteria.where("name").regex(quoted, "i"),
                    Criteria.where("organizationId").regex(quoted, "i"),
                    Criteria.where("category").regex(quoted, "i")
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
        boolean ascending = !SORT_DESC.equalsIgnoreCase(sortDirection);
        if (cursor != null && !cursor.trim().isEmpty()) {
            OrganizationKeysetCursor keyset = resolveCursor(cursor.trim(), sortField);
            applyKeyset(query, keyset, sortField, ascending);
        }

        query.limit(limit);

        Sort.Direction mongoSortDirection = ascending ? Sort.Direction.ASC : Sort.Direction.DESC;
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

    // A cursor issued before the compound format carries only the row id; its sort value comes from that row.
    private OrganizationKeysetCursor resolveCursor(String cursor, String sortField) {
        boolean idOnlyUnderValueSort = !ID_FIELD.equals(sortField) && OrganizationKeysetCursor.isBareId(cursor);
        if (!idOnlyUnderValueSort) {
            return OrganizationKeysetCursor.parse(cursor, sortField);
        }
        Organization anchor = mongoTemplate.findById(cursor, Organization.class);
        if (anchor == null) {
            throw new IllegalArgumentException(OrganizationKeysetCursor.INVALID_CURSOR_MESSAGE);
        }
        String compoundCursor = OrganizationKeysetCursor.encode(anchor, sortField);
        return OrganizationKeysetCursor.parse(compoundCursor, sortField);
    }

    // Keyset "past the cursor row" in the active direction: ASC pages upwards (>), DESC downwards (<),
    // with _id as the tie-breaker so equal sort values never repeat or skip a row.
    private void applyKeyset(Query query, OrganizationKeysetCursor keyset, String sortField, boolean ascending) {
        ObjectId cursorId = keyset.getId();
        Criteria pastId = ascending ? Criteria.where(ID_FIELD).gt(cursorId) : Criteria.where(ID_FIELD).lt(cursorId);
        if (ID_FIELD.equals(sortField)) {
            query.addCriteria(pastId);
            return;
        }
        Object sortValue = keyset.getSortValue();
        Criteria pastValue = ascending
                ? Criteria.where(sortField).gt(sortValue)
                : Criteria.where(sortField).lt(sortValue);
        Criteria sameValuePastId = new Criteria().andOperator(Criteria.where(sortField).is(sortValue), pastId);

        // Use a $or-keyed criteria (not the keyless Criteria.orOperator) so it
        // does not clash with the base filter's keyless $and — MongoDB Query
        // rejects a second keyless criteria. Mirrors CustomMachineRepositoryImpl.
        query.addCriteria(Criteria.where("$or").is(
                List.of(pastValue.getCriteriaObject(), sameValuePastId.getCriteriaObject())));
    }

    @Override
    public long countOrganizations(Query query) {
        return mongoTemplate.count(query, Organization.class);
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
