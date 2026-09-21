package com.openframe.data.repository.rmm;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.schedule.ScheduleScriptExecution;
import com.openframe.data.document.rmm.script.ScriptExecution;
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

import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
    private static final String CURSOR_SEPARATOR = "|";

    private static final Set<String> SORTABLE_FIELDS = Set.of(FIELD_ID, FIELD_DISPATCHED_AT);

    private final MongoTemplate mongoTemplate;

    @Override
    public List<ScheduleScriptExecution> findPageForSchedule(String tenantId,
                                                             String scriptScheduleId,
                                                             ScheduleRunQueryFilter filter,
                                                             String search,
                                                             String sortField,
                                                             Sort.Direction sortDirection,
                                                             String cursor,
                                                             boolean backward,
                                                             int limit) {
        Criteria criteria = applyCursor(baseCriteria(tenantId, scriptScheduleId, filter),
                cursor, backward, sortDirection, sortField);
        criteria = withSearch(criteria, search);

        Sort.Direction effectiveDir = backward ? flip(sortDirection) : sortDirection;
        Query query = new Query(criteria)
                .with(sortSpec(effectiveDir, sortField))
                .limit(limit);
        return mongoTemplate.find(query, ScheduleScriptExecution.class);
    }

    private static Sort sortSpec(Sort.Direction dir, String sortField) {
        Sort primary = Sort.by(dir, sortField);
        return FIELD_ID.equals(sortField) ? primary : primary.and(Sort.by(dir, FIELD_ID));
    }

    @Override
    public boolean isSortableField(String field) {
        return field != null && SORTABLE_FIELDS.contains(field);
    }

    @Override
    public String getDefaultSortField() {
        return FIELD_ID;
    }

    @Override
    public String encodeCursor(ScheduleScriptExecution run, String sortField) {
        if (run == null) {
            return null;
        }
        if (FIELD_ID.equals(sortField)) {
            return run.getId();
        }
        // dispatchedAt is non-null (stamped at fire) → epochMillis|id.
        long millis = run.getDispatchedAt() == null ? 0L : run.getDispatchedAt().toEpochMilli();
        return millis + CURSOR_SEPARATOR + run.getId();
    }

    private static Sort.Direction flip(Sort.Direction dir) {
        return dir == Sort.Direction.ASC ? Sort.Direction.DESC : Sort.Direction.ASC;
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

    private static Criteria applyCursor(Criteria base, String cursor, boolean backward,
                                        Sort.Direction sortDirection, String sortField) {
        if (isBlank(cursor)) {
            return base;
        }
        boolean desc = (sortDirection == Sort.Direction.DESC) ^ backward;

        if (FIELD_ID.equals(sortField)) {
            return new Criteria().andOperator(base, strictlyAfter(FIELD_ID, parseCursorId(cursor), desc));
        }

        int sep = cursor.lastIndexOf(CURSOR_SEPARATOR);
        if (sep < 0) {
            throw new BadRequestException("Invalid compound schedule-runs cursor (no separator): " + cursor);
        }
        Instant value = parseInstant(cursor.substring(0, sep));
        ObjectId id = parseCursorId(cursor.substring(sep + 1));

        // (dispatchedAt strictly-after value) OR (dispatchedAt == value AND _id strictly-after id).
        // dispatchedAt is non-null, so no null-bracket handling is needed.
        Criteria keyset = new Criteria().orOperator(
                strictlyAfter(FIELD_DISPATCHED_AT, value, desc),
                new Criteria().andOperator(Criteria.where(FIELD_DISPATCHED_AT).is(value), strictlyAfter(FIELD_ID, id, desc)));
        return new Criteria().andOperator(base, keyset);
    }

    /** One field's "strictly after the cursor" bound for the effective direction: {@code <} for DESC, {@code >} for ASC. */
    private static Criteria strictlyAfter(String field, Object value, boolean desc) {
        return desc ? Criteria.where(field).lt(value) : Criteria.where(field).gt(value);
    }

    private static ObjectId parseCursorId(String hex) {
        try {
            return new ObjectId(hex);
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Invalid ObjectId in schedule-runs cursor: " + hex);
        }
    }

    private static Instant parseInstant(String millis) {
        try {
            return Instant.ofEpochMilli(Long.parseLong(millis));
        } catch (NumberFormatException ex) {
            throw new BadRequestException("Unparseable epoch millis in schedule-runs cursor: " + millis);
        }
    }
}
