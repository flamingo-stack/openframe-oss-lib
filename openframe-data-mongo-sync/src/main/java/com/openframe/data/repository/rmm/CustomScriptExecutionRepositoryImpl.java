package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.ScriptExecution;
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
import com.mongodb.ReadPreference;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.EnumMap;
import java.util.Optional;
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
 * hex {@code ObjectId}, or a compound cursor missing its separator / with unparseable
 * epoch millis) is rejected fail-fast with
 * {@link com.openframe.core.exception.BadRequestException}. Silent fallback would drop
 * the cursor while preserving {@code backward=true}, returning the OLDEST rows in ASC
 * order alongside cursor-based {@code pageInfo} — a wrong-order surprise for the client.
 */
@Slf4j
@Repository
@RequiredArgsConstructor
public class CustomScriptExecutionRepositoryImpl implements CustomScriptExecutionRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_SOURCE = "source";
    private static final String FIELD_INITIATED_BY = "initiatedBy";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_EXECUTION_ID = "executionId";
    private static final String FIELD_SCRIPT_ID = "scriptId";
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
        Criteria criteria = withCursor(baseCriteria(tenantId, owner, filter, null),
                cursor, backward, sortDirection, sortField);
        criteria = withSearch(criteria, search);

        Sort.Direction effectiveDir = backward ? flip(sortDirection) : sortDirection;
        Query query = new Query(criteria).with(sortSpec(effectiveDir, sortField)).limit(limit);
        return mongoTemplate.find(query, ScriptExecution.class);
    }

    private static Sort sortSpec(Sort.Direction dir, String sortField) {
        Sort primary = Sort.by(dir, sortField);
        return FIELD_ID.equals(sortField) ? primary : primary.and(Sort.by(dir, FIELD_ID));
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
    public Optional<ScriptExecution> findByMachineIdAndExecutionIdAndScriptId(String machineId, String executionId, String scriptId) {
        Query query = new Query(Criteria.where(FIELD_MACHINE_ID).is(machineId)
                .and(FIELD_EXECUTION_ID).is(executionId)
                .and(FIELD_SCRIPT_ID).is(scriptId))
                .withReadPreference(ReadPreference.primary());
        return Optional.ofNullable(mongoTemplate.findOne(query, ScriptExecution.class));
    }

    @Override
    public List<ScriptExecution> findByMachineIdAndExecutionIdAndScriptIdIn(String machineId, String executionId, Collection<String> scriptIds) {
        if (scriptIds == null || scriptIds.isEmpty()) {
            return List.of();
        }
        Query query = new Query(Criteria.where(FIELD_MACHINE_ID).is(machineId)
                .and(FIELD_EXECUTION_ID).is(executionId)
                .and(FIELD_SCRIPT_ID).in(scriptIds))
                .withReadPreference(ReadPreference.primary());
        return mongoTemplate.find(query, ScriptExecution.class);
    }

    @Override
    public LeafStatusCounts countLeavesByStatus(String tenantId, String executionId) {
        if (tenantId == null || executionId == null) {
            return new LeafStatusCounts(0, 0);
        }
        long inProgress = countLeavesInStatus(tenantId, executionId, ExecutionStatus.QUEUED)
                + countLeavesInStatus(tenantId, executionId, ExecutionStatus.RUNNING);
        long failed = countLeavesInStatus(tenantId, executionId, ExecutionStatus.FAILED);
        return new LeafStatusCounts(inProgress, failed);
    }

    private long countLeavesInStatus(String tenantId, String executionId, ExecutionStatus status) {
        Query query = new Query(Criteria.where(FIELD_TENANT_ID).is(tenantId)
                .and(FIELD_EXECUTION_ID).is(executionId)
                .and(FIELD_STATUS).is(status))
                .withReadPreference(ReadPreference.primary());
        return mongoTemplate.count(query, ScriptExecution.class);
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
        // never dropped by facets: source is not a facet field, and the service-level
        // exclusion must hold in every counted bucket
        if (filter.getExcludedSources() != null && !filter.getExcludedSources().isEmpty()) {
            criteria.and(FIELD_SOURCE).nin(filter.getExcludedSources());
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
        // Inclusive [from, to] on dispatchedAt — never dropped by facets (not a facet field
        // itself, and the picker's range applies to every counted bucket).
        if (filter.getDispatchedAtFrom() != null || filter.getDispatchedAtTo() != null) {
            Criteria dispatchedAt = Criteria.where(FIELD_DISPATCHED_AT);
            if (filter.getDispatchedAtFrom() != null) {
                dispatchedAt = dispatchedAt.gte(filter.getDispatchedAtFrom());
            }
            if (filter.getDispatchedAtTo() != null) {
                dispatchedAt = dispatchedAt.lte(filter.getDispatchedAtTo());
            }
            // Merge via andOperator: dispatchedAt might already appear on the base (it doesn't
            // today, but future filters + this same key would collide with a plain .and()).
            return new Criteria().andOperator(criteria, dispatchedAt);
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

    private static Criteria withCursor(Criteria base, String cursor, boolean backward,
                                       Sort.Direction sortDirection, String sortField) {
        if (isBlank(cursor)) {
            return base;
        }
        boolean effectiveDesc = (sortDirection == Sort.Direction.DESC) ^ backward;

        if (FIELD_ID.equals(sortField)) {
            ObjectId cursorId = parseObjectId(cursor);
            return effectiveDesc ? base.and(FIELD_ID).lt(cursorId) : base.and(FIELD_ID).gt(cursorId);
        }

        int sep = cursor.lastIndexOf('|');
        if (sep < 0) {
            throw new com.openframe.core.exception.BadRequestException(
                    "Invalid compound cursor for execution pagination (no separator): " + cursor);
        }
        ObjectId cursorId = parseObjectId(cursor.substring(sep + 1));
        Instant cursorValue = parseInstantOrNull(cursor.substring(0, sep));
        Criteria clause = compoundCursorClause(sortField, cursorValue, cursorId, effectiveDesc);
        return new Criteria().andOperator(base, clause);
    }

    private static Criteria compoundCursorClause(String sortField, Instant cursorValue,
                                                 ObjectId cursorId, boolean desc) {
        if (cursorValue == null) {
            // Cursor row itself has a null sortField.
            if (desc) {
                // Only more null-sort rows remain (past cursorId on _id).
                return new Criteria().andOperator(
                        Criteria.where(sortField).isNull(),
                        Criteria.where(FIELD_ID).lt(cursorId));
            }
            // ASC: (null sort AND _id > cursorId) OR any non-null (non-null > null).
            return new Criteria().orOperator(
                    new Criteria().andOperator(
                            Criteria.where(sortField).isNull(),
                            Criteria.where(FIELD_ID).gt(cursorId)),
                    Criteria.where(sortField).ne(null));
        }
        // Non-null cursor.
        if (desc) {
            return new Criteria().orOperator(
                    Criteria.where(sortField).lt(cursorValue),
                    new Criteria().andOperator(
                            Criteria.where(sortField).is(cursorValue),
                            Criteria.where(FIELD_ID).lt(cursorId)),
                    Criteria.where(sortField).isNull());   // all nulls come after non-null in DESC
        }
        return new Criteria().orOperator(
                Criteria.where(sortField).gt(cursorValue),
                new Criteria().andOperator(
                        Criteria.where(sortField).is(cursorValue),
                        Criteria.where(FIELD_ID).gt(cursorId)));
        // ASC: nulls come first — already passed by definition of a non-null cursor.
    }

    /**
     * Parse the hex portion of a cursor as {@link ObjectId} — fail-fast rather than
     * silent-fallback, because a dropped cursor with {@code backward=true} would flip the
     * page into ASC order and return the oldest rows as if that were a valid "before" page.
     */
    private static ObjectId parseObjectId(String hex) {
        try {
            return new ObjectId(hex);
        } catch (IllegalArgumentException ex) {
            throw new com.openframe.core.exception.BadRequestException(
                    "Invalid ObjectId in execution cursor: " + hex);
        }
    }

    /** Same fail-fast rationale as {@link #parseObjectId}. Empty means "null cursor sort value". */
    private static Instant parseInstantOrNull(String millis) {
        if (millis.isEmpty()) {
            return null;
        }
        try {
            return Instant.ofEpochMilli(Long.parseLong(millis));
        } catch (NumberFormatException ex) {
            throw new com.openframe.core.exception.BadRequestException(
                    "Unparseable Instant epoch millis in execution cursor: " + millis);
        }
    }

    @Override
    public String encodeCursor(ScriptExecution row, String sortField) {
        String rawId = row.getId();
        if (FIELD_ID.equals(sortField)) {
            return rawId;
        }
        Instant value = extractInstantField(row, sortField);
        String millis = value == null ? "" : String.valueOf(value.toEpochMilli());
        return millis + "|" + rawId;
    }

    private static Instant extractInstantField(ScriptExecution row, String sortField) {
        return switch (sortField) {
            case FIELD_DISPATCHED_AT -> row.getDispatchedAt();
            case FIELD_FINISHED_AT -> row.getFinishedAt();
            case FIELD_STATUS_CHANGED_AT -> row.getStatusChangedAt();
            default -> null;
        };
    }

    private static Sort.Direction flip(Sort.Direction direction) {
        return direction == Sort.Direction.ASC ? Sort.Direction.DESC : Sort.Direction.ASC;
    }
}
