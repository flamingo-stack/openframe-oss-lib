package com.openframe.data.repository.rmm;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.ScheduleScriptExecution;
import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.filter.ScheduleRunQueryFilter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import static org.apache.commons.lang3.StringUtils.isBlank;

/**
 * MongoTemplate-backed implementation of {@link CustomScheduleScriptExecutionRepository}.
 *
 * <p>Header cursor pagination follows the same shape as {@code CustomScriptExecutionRepositoryImpl}:
 * cursor is a raw {@code ObjectId} hex; forward+DESC / backward+ASC compare {@code _id < cursor},
 * the other two want {@code >}. Default sort is {@code _id DESC} — one dispatch per {@code _id},
 * timestamp-embedded, so no separate {@code dispatchedAt} tiebreaker is needed.
 *
 * <p>The responded-devices aggregation runs over the LEAF collection ({@code script_executions})
 * — that's where per-(machine, script) state lives — and returns per-{@code executionId} counts.
 */
@Slf4j
@Repository
@RequiredArgsConstructor
public class CustomScheduleScriptExecutionRepositoryImpl implements CustomScheduleScriptExecutionRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_EXECUTION_ID = "executionId";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_INITIATED_BY = "initiatedBy";
    private static final String FIELD_SCRIPT_SCHEDULE_ID = "scheduleId";
    private static final String FIELD_DISPATCHED_AT = "dispatchedAt";
    private static final String FIELD_COUNT = "count";

    private final MongoTemplate mongoTemplate;

    @Override
    public List<ScheduleScriptExecution> findPageForSchedule(String tenantId,
                                                             String scriptScheduleId,
                                                             ScheduleRunQueryFilter filter,
                                                             String search,
                                                             String cursor,
                                                             boolean backward,
                                                             int limit) {
        Criteria criteria = baseCriteria(tenantId, scriptScheduleId, filter);
        applyCursor(criteria, cursor, backward);
        criteria = withSearch(criteria, search);

        // Default sort is _id DESC (newest first); backward paginates in the opposite direction.
        Sort.Direction effectiveDir = backward ? Sort.Direction.ASC : Sort.Direction.DESC;
        Query query = new Query(criteria)
                .with(Sort.by(effectiveDir, FIELD_ID))
                .limit(limit);
        return mongoTemplate.find(query, ScheduleScriptExecution.class);
    }

    @Override
    public long countForSchedule(String tenantId,
                                 String scriptScheduleId,
                                 ScheduleRunQueryFilter filter,
                                 String search) {
        Criteria criteria = withSearch(baseCriteria(tenantId, scriptScheduleId, filter), search);
        return mongoTemplate.count(new Query(criteria), ScheduleScriptExecution.class);
    }

    @Override
    public Map<String, Long> countRespondedDevicesByExecutionIds(String tenantId, Collection<String> executionIds) {
        if (tenantId == null || executionIds == null || executionIds.isEmpty()) {
            return Map.of();
        }

        // 1. Match terminal (non-RUNNING) leaves for the requested fires within the tenant.
        // 2. Group by (executionId, machineId) — collapses N per-script leaves per device into one row.
        // 3. Group by executionId — counts DISTINCT machineIds that responded.
        Aggregation agg = Aggregation.newAggregation(
                Aggregation.match(Criteria.where(FIELD_TENANT_ID).is(tenantId)
                        .and(FIELD_EXECUTION_ID).in(executionIds)
                        .and(FIELD_STATUS).ne(ExecutionStatus.RUNNING)),
                Aggregation.group(FIELD_EXECUTION_ID, FIELD_MACHINE_ID),
                Aggregation.group("_id." + FIELD_EXECUTION_ID).count().as(FIELD_COUNT));

        AggregationResults<Document> results = mongoTemplate.aggregate(agg, ScriptExecution.class, Document.class);

        Map<String, Long> counts = new HashMap<>();
        for (Document doc : results.getMappedResults()) {
            Object id = doc.get(FIELD_ID);
            if (id == null) {
                continue;
            }
            counts.put(id.toString(), ((Number) doc.get(FIELD_COUNT)).longValue());
        }
        return counts;
    }

    @Override
    public Map<String, Integer> facet(String tenantId,
                                      String scriptScheduleId,
                                      ScheduleRunQueryFilter filter,
                                      String search,
                                      String field) {
        Criteria criteria = withSearch(facetCriteria(tenantId, scriptScheduleId, filter, field), search);
        Aggregation agg = Aggregation.newAggregation(
                Aggregation.match(criteria),
                Aggregation.group(field).count().as(FIELD_COUNT));
        AggregationResults<Document> results =
                mongoTemplate.aggregate(agg, ScheduleScriptExecution.class, Document.class);

        Map<String, Integer> counts = new LinkedHashMap<>();
        for (Document doc : results.getMappedResults()) {
            Object id = doc.get(FIELD_ID);
            if (id == null) {
                // Rows with a null group key (e.g. no initiator recorded) are not a facet option.
                continue;
            }
            counts.put(id.toString(), ((Number) doc.get(FIELD_COUNT)).intValue());
        }
        return counts;
    }

    /**
     * Match criteria for a facet: tenant + schedule + dispatchedAt range (+ search, applied by the
     * caller), but the {@code groupField}'s own filter arm is dropped so that field's dropdown keeps
     * every value. The dispatchedAt range is never dropped (it is not a facet field).
     */
    private static Criteria facetCriteria(String tenantId, String scriptScheduleId,
                                          ScheduleRunQueryFilter filter, String groupField) {
        Criteria criteria = Criteria.where(FIELD_TENANT_ID).is(tenantId)
                .and(FIELD_SCRIPT_SCHEDULE_ID).is(scriptScheduleId);
        if (filter == null) {
            return criteria;
        }
        if (!FIELD_STATUS.equals(groupField)
                && filter.getStatuses() != null && !filter.getStatuses().isEmpty()) {
            criteria.and(FIELD_STATUS).in(filter.getStatuses());
        }
        if (filter.getDispatchedAtFrom() != null || filter.getDispatchedAtTo() != null) {
            Criteria dispatchedAt = Criteria.where(FIELD_DISPATCHED_AT);
            if (filter.getDispatchedAtFrom() != null) {
                dispatchedAt = dispatchedAt.gte(filter.getDispatchedAtFrom());
            }
            if (filter.getDispatchedAtTo() != null) {
                dispatchedAt = dispatchedAt.lte(filter.getDispatchedAtTo());
            }
            return new Criteria().andOperator(criteria, dispatchedAt);
        }
        return criteria;
    }

    private static Criteria baseCriteria(String tenantId, String scriptScheduleId, ScheduleRunQueryFilter filter) {
        Criteria criteria = Criteria.where(FIELD_TENANT_ID).is(tenantId)
                .and(FIELD_SCRIPT_SCHEDULE_ID).is(scriptScheduleId);
        if (filter == null) {
            return criteria;
        }
        if (filter.getStatuses() != null && !filter.getStatuses().isEmpty()) {
            criteria.and(FIELD_STATUS).in(filter.getStatuses());
        }
        // Inclusive [from, to] on dispatchedAt — either bound may be null.
        if (filter.getDispatchedAtFrom() != null || filter.getDispatchedAtTo() != null) {
            Criteria dispatchedAt = Criteria.where(FIELD_DISPATCHED_AT);
            if (filter.getDispatchedAtFrom() != null) {
                dispatchedAt = dispatchedAt.gte(filter.getDispatchedAtFrom());
            }
            if (filter.getDispatchedAtTo() != null) {
                dispatchedAt = dispatchedAt.lte(filter.getDispatchedAtTo());
            }
            // Merge into base — Criteria.where(field).and(...).and(field2)... conflicts if the
            // field is already applied; use andOperator to avoid a "same-key" collision.
            return new Criteria().andOperator(criteria, dispatchedAt);
        }
        return criteria;
    }

    private static Criteria withSearch(Criteria base, String search) {
        if (isBlank(search)) {
            return base;
        }
        String regex = Pattern.quote(search.trim());
        Criteria match = Criteria.where(FIELD_EXECUTION_ID).regex(regex, "i");
        return new Criteria().andOperator(base, match);
    }

    private static void applyCursor(Criteria criteria, String cursor, boolean backward) {
        if (isBlank(cursor)) {
            return;
        }
        ObjectId cursorId;
        try {
            cursorId = new ObjectId(cursor);
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Invalid schedule-runs cursor: " + cursor);
        }
        // Default sort is DESC; forward+DESC and backward+ASC both want _id < cursor.
        boolean useLessThan = !backward;
        if (useLessThan) {
            criteria.and(FIELD_ID).lt(cursorId);
        } else {
            criteria.and(FIELD_ID).gt(cursorId);
        }
    }
}
