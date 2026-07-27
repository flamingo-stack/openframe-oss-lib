package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.filter.ExecutionFacetField;
import com.openframe.data.document.rmm.filter.ExecutionOwnerScope;
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

import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import static org.apache.commons.lang3.StringUtils.isBlank;

/**
 * MongoTemplate-backed implementation of {@link CustomScriptExecutionRepository}.
 *
 * <p>The list / count / facet queries are owner-agnostic — {@link ExecutionOwnerScope}
 * decides which owner field narrows the base predicate. Facet queries drop the "own"
 * filter arm so their dropdowns keep offering every switchable value.
 *
 * <p>Cursor pagination is implemented on {@code _id}: descending by default
 * ({@code newest first}), with the cursor comparison flipped when paginating backward.
 * The predicate is tenant-scoped + owner-scoped so it hits the compound index prefix;
 * the {@code _id} sort/cursor is a natural tiebreaker.
 *
 * <p>The cursor value is parsed into a Mongo {@link ObjectId} before being applied —
 * comparing a String against a BSON {@code ObjectId} field does not match correctly
 * under Mongo's type-bracketing rules. An invalid cursor (anything not a valid 24-char
 * hex {@code ObjectId}) is logged and treated as "no cursor", returning the first page
 * rather than an opaque server error.
 */
@Slf4j
@Repository
@RequiredArgsConstructor
public class CustomScriptExecutionRepositoryImpl implements CustomScriptExecutionRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_INITIATED_BY = "initiatedBy";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_EXECUTION_ID = "executionId";
    private static final String FIELD_STDOUT = "stdout";
    private static final String FIELD_STDERR = "stderr";
    private static final String FIELD_DISPATCHED_AT = "dispatchedAt";
    private static final String FIELD_FINISHED_AT = "finishedAt";
    private static final String FIELD_STATUS_CHANGED_AT = "statusChangedAt";
    private static final String FIELD_COUNT = "count";

    /** Sort-field allowlist. Anything not in here falls back to {@link #getDefaultSortField()}. */
    private static final Set<String> SORTABLE_FIELDS = Set.of(
            FIELD_ID, FIELD_DISPATCHED_AT, FIELD_FINISHED_AT, FIELD_STATUS_CHANGED_AT);

    /** Owner-scope type → the Mongo field that narrows the base predicate for that owner. */
    private static final Map<ExecutionOwnerScope.Type, String> OWNER_FIELDS = new EnumMap<>(Map.of(
            ExecutionOwnerScope.Type.SCRIPT, "scriptId",
            ExecutionOwnerScope.Type.SCHEDULE, "scheduleId"));

    /** Facet enum → the Mongo field to group by / drop from the filter. */
    private static final Map<ExecutionFacetField, String> FACET_FIELDS = new EnumMap<>(Map.of(
            ExecutionFacetField.STATUS, FIELD_STATUS,
            ExecutionFacetField.INITIATOR, FIELD_INITIATED_BY,
            ExecutionFacetField.MACHINE, FIELD_MACHINE_ID));

    private final MongoTemplate mongoTemplate;

    @Override
    public List<ScriptExecution> findPage(String tenantId, ExecutionOwnerScope owner,
                                          ScriptExecutionQueryFilter filter,
                                          String sortField, Sort.Direction sortDirection,
                                          String cursor, boolean backward, int limit, String search) {
        Criteria criteria = baseCriteria(tenantId, owner, filter, null);
        applyCursor(criteria, cursor, backward, sortDirection);
        criteria = withSearch(criteria, search);

        Sort.Direction effectiveDir = backward ? flip(sortDirection) : sortDirection;
        Query query = new Query(criteria).with(Sort.by(effectiveDir, sortField)).limit(limit);
        return mongoTemplate.find(query, ScriptExecution.class);
    }

    @Override
    public long count(String tenantId, ExecutionOwnerScope owner,
                      ScriptExecutionQueryFilter filter, String search) {
        Criteria criteria = withSearch(baseCriteria(tenantId, owner, filter, null), search);
        return mongoTemplate.count(new Query(criteria), ScriptExecution.class);
    }

    @Override
    public Map<String, Integer> facet(String tenantId, ExecutionOwnerScope owner,
                                      ScriptExecutionQueryFilter filter, String search,
                                      ExecutionFacetField facet) {
        String groupField = FACET_FIELDS.get(facet);
        Criteria criteria = withSearch(baseCriteria(tenantId, owner, filter, groupField), search);
        return facetCounts(criteria, groupField);
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
    public LeafStatusCounts countLeavesByStatus(String tenantId, String executionId) {
        if (tenantId == null || executionId == null) {
            return new LeafStatusCounts(0, 0);
        }
        AggregationResults<Document> results = mongoTemplate.aggregate(
                Aggregation.newAggregation(
                        Aggregation.match(Criteria.where(FIELD_TENANT_ID).is(tenantId)
                                .and(FIELD_EXECUTION_ID).is(executionId)),
                        Aggregation.group(FIELD_STATUS).count().as(FIELD_COUNT)),
                ScriptExecution.class, Document.class);

        long running = 0;
        long failed = 0;
        for (Document g : results.getMappedResults()) {
            Object status = g.get(FIELD_ID);
            if (status == null) {
                continue;
            }
            long c = ((Number) g.get(FIELD_COUNT)).longValue();
            if (ExecutionStatus.RUNNING.name().equals(status.toString())) {
                running = c;
            } else if (ExecutionStatus.FAILED.name().equals(status.toString())) {
                failed = c;
            }
        }
        return new LeafStatusCounts(running, failed);
    }

    // ────────── Owner-agnostic core ──────────

    /**
     * Tenant + owner scope + applicable filter arms. When {@code excludedField} is non-null
     * the matching filter arm is dropped — used by facet queries so each dropdown keeps
     * offering every switchable value.
     */
    private static Criteria baseCriteria(String tenantId, ExecutionOwnerScope owner,
                                         ScriptExecutionQueryFilter filter, String excludedField) {
        Criteria criteria = Criteria.where(FIELD_TENANT_ID).is(tenantId)
                .and(OWNER_FIELDS.get(owner.type())).is(owner.id());
        if (filter == null) {
            return criteria;
        }
        if (!FIELD_STATUS.equals(excludedField)
                && filter.getStatuses() != null && !filter.getStatuses().isEmpty()) {
            criteria.and(FIELD_STATUS).in(filter.getStatuses());
        }
        if (!FIELD_INITIATED_BY.equals(excludedField)
                && filter.getInitiatedByIds() != null && !filter.getInitiatedByIds().isEmpty()) {
            criteria.and(FIELD_INITIATED_BY).in(filter.getInitiatedByIds());
        }
        if (!FIELD_MACHINE_ID.equals(excludedField)
                && filter.getMachineIds() != null && !filter.getMachineIds().isEmpty()) {
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

    /** Run a {@code match → group(field).count()} aggregation and collapse it to {@code value → count}. */
    private Map<String, Integer> facetCounts(Criteria criteria, String groupField) {
        AggregationResults<Document> results = mongoTemplate.aggregate(
                Aggregation.newAggregation(
                        Aggregation.match(criteria),
                        Aggregation.group(groupField).count().as(FIELD_COUNT)),
                ScriptExecution.class, Document.class);

        Map<String, Integer> counts = new LinkedHashMap<>();
        for (Document doc : results.getMappedResults()) {
            Object value = doc.get(FIELD_ID);
            if (value == null) {
                continue;   // rows with no value for the facet field (e.g. system-initiated) are dropped
            }
            counts.put(value.toString(), ((Number) doc.get(FIELD_COUNT)).intValue());
        }
        return counts;
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
        // The comparison direction depends on BOTH the sort direction and the pagination direction:
        // forward+DESC and backward+ASC both want _id < cursor; the other two want _id > cursor.
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
