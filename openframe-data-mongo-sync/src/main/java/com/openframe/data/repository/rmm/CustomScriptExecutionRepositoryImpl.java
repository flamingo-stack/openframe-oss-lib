package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.filter.ScriptExecutionQueryFilter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Set;

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
                                                   int limit) {
        Criteria criteria = baseCriteria(tenantId, scriptId, filter);
        applyCursor(criteria, cursor, backward, sortDirection);

        Sort.Direction effectiveDir = backward ? flip(sortDirection) : sortDirection;
        Query query = new Query(criteria)
                .with(Sort.by(effectiveDir, sortField))
                .limit(limit);

        return mongoTemplate.find(query, ScriptExecution.class);
    }

    @Override
    public long countForScript(String tenantId, String scriptId, ScriptExecutionQueryFilter filter) {
        // Same predicate as a page fetch but WITHOUT cursor/limit/sort — the
        // full matching count for the (tenant, script, filter) tuple.
        return mongoTemplate.count(new Query(baseCriteria(tenantId, scriptId, filter)), ScriptExecution.class);
    }

    private static Criteria baseCriteria(String tenantId, String scriptId, ScriptExecutionQueryFilter filter) {
        Criteria criteria = Criteria.where(FIELD_TENANT_ID).is(tenantId)
                .and(FIELD_SCRIPT_ID).is(scriptId);
        if (filter != null && filter.getStatuses() != null && !filter.getStatuses().isEmpty()) {
            criteria.and(FIELD_STATUS).in(filter.getStatuses());
        }
        return criteria;
    }

    @Override
    public boolean isSortableField(String field) {
        return field != null && SORTABLE_FIELDS.contains(field);
    }

    @Override
    public String getDefaultSortField() {
        return FIELD_ID;
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
