package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.document.rmm.filter.ScriptScheduleQueryFilter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import static org.apache.commons.lang3.StringUtils.isBlank;

/**
 * MongoTemplate-backed implementation of {@link CustomScriptScheduleRepository}.
 *
 * <p>Cursor pagination is implemented on {@code _id} (descending by default),
 * with the comparison flipped when paginating backward. All queries are
 * tenant-scoped. Mirrors {@code CustomScriptRepositoryImpl}; an invalid cursor
 * is logged and treated as "no cursor" (first page).
 */
@Slf4j
@Repository
@RequiredArgsConstructor
public class CustomScriptScheduleRepositoryImpl implements CustomScriptScheduleRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_NAME = "name";
    private static final String FIELD_SUPPORTED_PLATFORMS = "supportedPlatforms";
    private static final String FIELD_CREATED_AT = "createdAt";
    private static final String FIELD_UPDATED_AT = "updatedAt";
    private static final String FIELD_CREATED_BY = "createdBy";
    private static final String FIELD_COUNT = "count";

    /** Sort-field allowlist. Anything not in here falls back to {@link #getDefaultSortField()}. */
    private static final Set<String> SORTABLE_FIELDS =
            Set.of(FIELD_ID, FIELD_NAME, FIELD_CREATED_AT, FIELD_UPDATED_AT);

    private final MongoTemplate mongoTemplate;

    @Override
    public List<ScriptSchedule> findPageForTenant(String tenantId,
                                                  ScriptScheduleQueryFilter filter,
                                                  String search,
                                                  String sortField,
                                                  Sort.Direction sortDirection,
                                                  String cursor,
                                                  boolean backward,
                                                  int limit) {
        Criteria criteria = buildBaseCriteria(tenantId, filter, search);
        applyCursor(criteria, cursor, backward, sortDirection);

        Sort.Direction effectiveDir = backward ? flip(sortDirection) : sortDirection;
        Query query = new Query(criteria)
                .with(Sort.by(effectiveDir, sortField))
                .limit(limit);

        return mongoTemplate.find(query, ScriptSchedule.class);
    }

    @Override
    public long countForTenant(String tenantId, ScriptScheduleQueryFilter filter, String search) {
        Query query = new Query(buildBaseCriteria(tenantId, filter, search));
        return mongoTemplate.count(query, ScriptSchedule.class);
    }

    /**
     * Build the shared tenant + filter + search predicate (no cursor, no sort,
     * no limit) used by both the page fetch and the count.
     */
    private Criteria buildBaseCriteria(String tenantId, ScriptScheduleQueryFilter filter, String search) {
        Criteria criteria = Criteria.where(FIELD_TENANT_ID).is(tenantId);
        applyStatusFilter(criteria, filter);
        applyPlatformsFilter(criteria, filter);
        applyCreatedByFilter(criteria, filter);
        applySearch(criteria, search);
        return criteria;
    }

    @Override
    public Map<String, Integer> platformFacet(String tenantId, ScriptScheduleQueryFilter filter) {
        return facetCounts(facetCriteria(tenantId, filter, FIELD_SUPPORTED_PLATFORMS), FIELD_SUPPORTED_PLATFORMS, true);
    }

    @Override
    public Map<String, Integer> authorFacet(String tenantId, ScriptScheduleQueryFilter filter) {
        return facetCounts(facetCriteria(tenantId, filter, FIELD_CREATED_BY), FIELD_CREATED_BY, false);
    }

    /**
     * Tenant + filter predicate for a facet query: the same constraints as the
     * list (incl. the default DELETED-exclusion), EXCEPT the facet's own field
     * is dropped — so its dropdown still offers every switchable value.
     */
    private Criteria facetCriteria(String tenantId, ScriptScheduleQueryFilter filter, String excludeField) {
        Criteria criteria = Criteria.where(FIELD_TENANT_ID).is(tenantId);
        applyStatusFilter(criteria, filter);
        if (!FIELD_SUPPORTED_PLATFORMS.equals(excludeField)) {
            applyPlatformsFilter(criteria, filter);
        }
        if (!FIELD_CREATED_BY.equals(excludeField)) {
            applyCreatedByFilter(criteria, filter);
        }
        return criteria;
    }

    /** {@code match → [unwind] → group(field).count()} → {value → count}; null values are dropped. */
    private Map<String, Integer> facetCounts(Criteria match, String groupField, boolean unwind) {
        List<AggregationOperation> ops = new ArrayList<>();
        ops.add(Aggregation.match(match));
        if (unwind) {
            ops.add(Aggregation.unwind(groupField));
        }
        ops.add(Aggregation.group(groupField).count().as(FIELD_COUNT));
        AggregationResults<Document> results =
                mongoTemplate.aggregate(Aggregation.newAggregation(ops), ScriptSchedule.class, Document.class);

        Map<String, Integer> counts = new LinkedHashMap<>();
        for (Document doc : results.getMappedResults()) {
            Object value = doc.get(FIELD_ID);
            if (value == null) {
                continue;
            }
            counts.put(value.toString(), ((Number) doc.get(FIELD_COUNT)).intValue());
        }
        return counts;
    }

    @Override
    public boolean isSortableField(String field) {
        return field != null && SORTABLE_FIELDS.contains(field);
    }

    @Override
    public String getDefaultSortField() {
        return FIELD_ID;
    }

    private static void applyStatusFilter(Criteria criteria, ScriptScheduleQueryFilter filter) {
        if (filter != null && filter.getStatuses() != null && !filter.getStatuses().isEmpty()) {
            criteria.and(FIELD_STATUS).in(filter.getStatuses());
        } else {
            // Default: hide soft-deleted schedules ({@code $ne} also covers legacy null status).
            criteria.and(FIELD_STATUS).ne(ScriptStatus.DELETED);
        }
    }

    private static void applyPlatformsFilter(Criteria criteria, ScriptScheduleQueryFilter filter) {
        if (filter != null && filter.getSupportedPlatforms() != null && !filter.getSupportedPlatforms().isEmpty()) {
            criteria.and(FIELD_SUPPORTED_PLATFORMS).in(filter.getSupportedPlatforms());
        }
    }

    private static void applyCreatedByFilter(Criteria criteria, ScriptScheduleQueryFilter filter) {
        if (filter != null && filter.getCreatedByIds() != null && !filter.getCreatedByIds().isEmpty()) {
            criteria.and(FIELD_CREATED_BY).in(filter.getCreatedByIds());
        }
    }

    private static void applySearch(Criteria criteria, String search) {
        if (isBlank(search)) {
            return;
        }
        criteria.and(FIELD_NAME).regex(Pattern.quote(search.trim()), "i");
    }

    private static void applyCursor(Criteria criteria, String cursor, boolean backward, Sort.Direction sortDirection) {
        if (isBlank(cursor)) {
            return;
        }

        ObjectId cursorId;
        try {
            cursorId = new ObjectId(cursor);
        } catch (IllegalArgumentException ex) {
            log.warn("Invalid ObjectId cursor for schedule pagination: '{}' — falling back to first page", cursor);
            return;
        }

        // forward+DESC and backward+ASC both want {@code _id < cursor};
        // forward+ASC and backward+DESC want {@code _id > cursor}.
        boolean useLessThan = (sortDirection == Sort.Direction.DESC) ^ backward;
        if (useLessThan) {
            criteria.and(FIELD_ID).lt(cursorId);
        } else {
            criteria.and(FIELD_ID).gt(cursorId);
        }
    }

    private static Sort.Direction flip(Sort.Direction direction) {
        return direction == Sort.Direction.ASC ? Sort.Direction.DESC : Sort.Direction.ASC;
    }
}
