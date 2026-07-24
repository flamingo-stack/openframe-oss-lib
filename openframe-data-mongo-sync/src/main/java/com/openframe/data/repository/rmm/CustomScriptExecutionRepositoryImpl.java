package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.filter.ScriptExecutionQueryFilter;
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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import static org.apache.commons.lang3.StringUtils.isBlank;

/**
 * MongoTemplate-backed implementation of {@link CustomScriptExecutionRepository}.
 *
 * <p>Cursor pagination is implemented on {@code _id}: descending by default
 * ({@code newest first}), with the cursor comparison flipped when paginating
 * backward. The query is tenant-scoped and narrowed to a single
 * {@code scriptId}, hitting the {@code (tenantId, scriptId, dispatchedAt)}
 * compound index for the predicate prefix plus a natural {@code _id} sort.
 *
 * <p>The cursor value is parsed into a Mongo {@link ObjectId} before being
 * applied — comparing a String against a BSON {@code ObjectId} field does not
 * match correctly under Mongo's type-bracketing rules. An invalid cursor
 * (anything not a valid 24-char hex {@code ObjectId}) is logged and treated as
 * "no cursor", returning the first page rather than an opaque server error.
 */
@Slf4j
@Repository
@RequiredArgsConstructor
public class CustomScriptExecutionRepositoryImpl implements CustomScriptExecutionRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_SCRIPT_ID = "scriptId";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_INITIATED_BY = "initiatedBy";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_EXECUTION_ID = "executionId";
    private static final String FIELD_STDOUT = "stdout";
    private static final String FIELD_STDERR = "stderr";
    private static final String FIELD_DISPATCHED_AT = "dispatchedAt";
    private static final String FIELD_FINISHED_AT = "finishedAt";
    private static final String FIELD_STATUS_CHANGED_AT = "statusChangedAt";

    /** Sort-field allowlist. Anything not in here falls back to {@link #getDefaultSortField()}. */
    private static final Set<String> SORTABLE_FIELDS = Set.of(
            FIELD_ID, FIELD_DISPATCHED_AT, FIELD_FINISHED_AT, FIELD_STATUS_CHANGED_AT);

    private final MongoTemplate mongoTemplate;

    @Override
    public List<ScriptExecution> findPageForScript(String tenantId,
                                                   String scriptId,
                                                   ScriptExecutionQueryFilter filter,
                                                   String sortField,
                                                   Sort.Direction sortDirection,
                                                   String cursor,
                                                   boolean backward,
                                                   int limit,
                                                   String search) {
        Criteria criteria = baseCriteria(tenantId, scriptId, filter);
        applyCursor(criteria, cursor, backward, sortDirection);
        criteria = withSearch(criteria, search);

        Sort.Direction effectiveDir = backward ? flip(sortDirection) : sortDirection;
        Query query = new Query(criteria)
                .with(Sort.by(effectiveDir, sortField))
                .limit(limit);

        return mongoTemplate.find(query, ScriptExecution.class);
    }

    @Override
    public long countForScript(String tenantId, String scriptId, ScriptExecutionQueryFilter filter, String search) {
        // Same predicate as a page fetch but WITHOUT cursor/limit/sort — the
        // full matching count for the (tenant, script, filter, search) tuple.
        Criteria criteria = withSearch(baseCriteria(tenantId, scriptId, filter), search);
        return mongoTemplate.count(new Query(criteria), ScriptExecution.class);
    }

    private static Criteria baseCriteria(String tenantId, String scriptId, ScriptExecutionQueryFilter filter) {
        Criteria criteria = Criteria.where(FIELD_TENANT_ID).is(tenantId)
                .and(FIELD_SCRIPT_ID).is(scriptId);
        if (filter != null && filter.getStatuses() != null && !filter.getStatuses().isEmpty()) {
            criteria.and(FIELD_STATUS).in(filter.getStatuses());
        }
        if (filter != null && filter.getInitiatedByIds() != null && !filter.getInitiatedByIds().isEmpty()) {
            criteria.and(FIELD_INITIATED_BY).in(filter.getInitiatedByIds());
        }
        if (filter != null && filter.getMachineIds() != null && !filter.getMachineIds().isEmpty()) {
            criteria.and(FIELD_MACHINE_ID).in(filter.getMachineIds());
        }
        return criteria;
    }

    private static Criteria withSearch(Criteria base, String search) {
        if (isBlank(search)) {
            return base;
        }
        String regex = Pattern.quote(search.trim());
        Criteria match = new Criteria().orOperator(
                Criteria.where(FIELD_EXECUTION_ID).regex(regex, "i"),
                Criteria.where(FIELD_MACHINE_ID).regex(regex, "i"),
                Criteria.where(FIELD_STDOUT).regex(regex, "i"),
                Criteria.where(FIELD_STDERR).regex(regex, "i"));
        return new Criteria().andOperator(base, match);
    }

    @Override
    public Map<String, Integer> initiatorFacet(String tenantId, String scriptId,
                                               ScriptExecutionQueryFilter filter, String search) {
        // Same predicate as the list EXCEPT the initiatedBy filter (own facet field): tenant +
        // scriptId + statuses + machineIds + search, then group by initiatedBy.
        Criteria criteria = Criteria.where(FIELD_TENANT_ID).is(tenantId).and(FIELD_SCRIPT_ID).is(scriptId);
        if (filter != null && filter.getStatuses() != null && !filter.getStatuses().isEmpty()) {
            criteria.and(FIELD_STATUS).in(filter.getStatuses());
        }
        if (filter != null && filter.getMachineIds() != null && !filter.getMachineIds().isEmpty()) {
            criteria.and(FIELD_MACHINE_ID).in(filter.getMachineIds());
        }
        criteria = withSearch(criteria, search);
        return facetCounts(criteria, FIELD_INITIATED_BY);
    }

    @Override
    public Map<String, Integer> statusFacet(String tenantId, String scriptId,
                                            ScriptExecutionQueryFilter filter, String search) {
        // Same predicate as the list EXCEPT the status filter (own facet field): tenant +
        // scriptId + initiatedByIds + machineIds + search, then group by status.
        Criteria criteria = Criteria.where(FIELD_TENANT_ID).is(tenantId).and(FIELD_SCRIPT_ID).is(scriptId);
        if (filter != null && filter.getInitiatedByIds() != null && !filter.getInitiatedByIds().isEmpty()) {
            criteria.and(FIELD_INITIATED_BY).in(filter.getInitiatedByIds());
        }
        if (filter != null && filter.getMachineIds() != null && !filter.getMachineIds().isEmpty()) {
            criteria.and(FIELD_MACHINE_ID).in(filter.getMachineIds());
        }
        criteria = withSearch(criteria, search);
        return facetCounts(criteria, FIELD_STATUS);
    }

    @Override
    public Map<String, Integer> machineFacet(String tenantId, String scriptId,
                                             ScriptExecutionQueryFilter filter, String search) {
        // Same predicate as the list EXCEPT the machineId filter (own facet field): tenant +
        // scriptId + statuses + initiatedByIds + search, then group by machineId.
        Criteria criteria = Criteria.where(FIELD_TENANT_ID).is(tenantId).and(FIELD_SCRIPT_ID).is(scriptId);
        if (filter != null && filter.getStatuses() != null && !filter.getStatuses().isEmpty()) {
            criteria.and(FIELD_STATUS).in(filter.getStatuses());
        }
        if (filter != null && filter.getInitiatedByIds() != null && !filter.getInitiatedByIds().isEmpty()) {
            criteria.and(FIELD_INITIATED_BY).in(filter.getInitiatedByIds());
        }
        criteria = withSearch(criteria, search);
        return facetCounts(criteria, FIELD_MACHINE_ID);
    }

    /** Run a {@code match → group(field).count()} aggregation and collapse it to {@code value → count}. */
    private Map<String, Integer> facetCounts(Criteria criteria, String groupField) {
        AggregationResults<Document> results = mongoTemplate.aggregate(
                Aggregation.newAggregation(
                        Aggregation.match(criteria),
                        Aggregation.group(groupField).count().as("count")),
                ScriptExecution.class, Document.class);

        Map<String, Integer> counts = new LinkedHashMap<>();
        for (Document doc : results.getMappedResults()) {
            Object value = doc.get("_id");
            if (value == null) {
                continue;   // rows with no value for the facet field (e.g. system-initiated) are dropped
            }
            counts.put(value.toString(), ((Number) doc.get("count")).intValue());
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

    @Override
    public LeafStatusTally tallyByExecutionId(String tenantId, String executionId) {
        if (tenantId == null || executionId == null) {
            return new LeafStatusTally(0, 0);
        }
        AggregationResults<Document> results = mongoTemplate.aggregate(
                Aggregation.newAggregation(
                        Aggregation.match(Criteria.where(FIELD_TENANT_ID).is(tenantId)
                                .and(FIELD_EXECUTION_ID).is(executionId)),
                        Aggregation.group(FIELD_STATUS).count().as("count")),
                ScriptExecution.class, Document.class);

        long running = 0;
        long failed = 0;
        for (Document g : results.getMappedResults()) {
            Object status = g.get("_id");
            if (status == null) {
                continue;
            }
            long count = ((Number) g.get("count")).longValue();
            if (com.openframe.data.document.rmm.ExecutionStatus.RUNNING.name().equals(status.toString())) {
                running = count;
            } else if (com.openframe.data.document.rmm.ExecutionStatus.FAILED.name().equals(status.toString())) {
                failed = count;
            }
        }
        return new LeafStatusTally(running, failed);
    }

    private static void applyCursor(Criteria criteria, String cursor, boolean backward, Sort.Direction sortDirection) {
        if (isBlank(cursor)) {
            return;
        }

        ObjectId cursorId;
        try {
            cursorId = new ObjectId(cursor);
        } catch (IllegalArgumentException ex) {
            log.warn("Invalid ObjectId cursor for execution pagination: '{}' — falling back to first page", cursor);
            return;
        }

        // The comparison direction depends on BOTH the sort direction and the
        // pagination direction: forward+DESC and backward+ASC both want
        // {@code _id < cursor}; forward+ASC and backward+DESC want {@code _id > cursor}.
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
