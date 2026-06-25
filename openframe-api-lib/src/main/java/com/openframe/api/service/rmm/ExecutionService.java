package com.openframe.api.service.rmm;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.execution.ExecutionResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.ExecutionMapper;
import com.openframe.data.document.rmm.Execution;
import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.repository.rmm.ExecutionRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Set;

/**
 * Application-level operations on RMM execution rows (the Script Details →
 * Execution History list).
 *
 * <p>Tenant scoping resolves internally via {@link TenantIdProvider} — same
 * pattern as {@link ScriptService}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ExecutionService {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_SCRIPT_ID = "scriptId";
    private static final String FIELD_DISPATCHED_AT = "dispatchedAt";
    private static final String FIELD_FINISHED_AT = "finishedAt";
    private static final String FIELD_STATUS_CHANGED_AT = "statusChangedAt";

    /** Sort-field allowlist. Anything not in here falls back to {@link #FIELD_ID}. */
    private static final Set<String> SORTABLE_FIELDS = Set.of(
            FIELD_ID, FIELD_DISPATCHED_AT, FIELD_FINISHED_AT, FIELD_STATUS_CHANGED_AT);

    private final ExecutionRepository executionRepository;
    private final TenantIdProvider tenantIdProvider;
    private final ExecutionMapper executionMapper;
    private final MongoTemplate mongoTemplate;

    /**
     * Persist a new {@link Execution} row in {@link ExecutionStatus#RUNNING}
     * state immediately before the dispatch is published on NATS.
     *
     * <p>Only {@code scriptId} is stored — the script's display name is resolved
     * at read time (GraphQL {@code Execution.scriptName} field resolver), so a
     * later rename of the source {@code Script} is reflected in History without
     * duplicating the name onto every row.
     */
    public Execution create(String executionId,
                            String scriptId,
                            String machineId,
                            PrivilegeLevel privilegeLevel,
                            String initiatedBy) {
        Instant now = Instant.now();
        Execution execution = buildRunningRow(executionId, scriptId, machineId, privilegeLevel, initiatedBy, now);
        Execution saved = executionRepository.save(execution);
        log.info("Persisted execution row: executionId={} scriptId={} machineId={} initiatedBy={} status=RUNNING",
                executionId, scriptId, machineId, initiatedBy);
        return saved;
    }

    /**
     * Bulk-persist one {@link ExecutionStatus#RUNNING} row per target machine
     * under a shared {@code executionId} — backs batch dispatch. Unique
     * constraint is {@code (tenantId, executionId, machineId)}, so the same
     * {@code executionId} repeats across rows while each {@code machineId}
     * stays distinct.
     */
    public List<Execution> createBatch(String executionId,
                                       String scriptId,
                                       List<String> machineIds,
                                       PrivilegeLevel privilegeLevel,
                                       String initiatedBy) {
        Instant now = Instant.now();
        List<Execution> rows = machineIds.stream()
                .map(machineId -> buildRunningRow(executionId, scriptId, machineId, privilegeLevel, initiatedBy, now))
                .toList();
        List<Execution> saved = executionRepository.saveAll(rows);
        log.info("Persisted batch execution rows: executionId={} scriptId={} machineCount={} initiatedBy={} status=RUNNING",
                executionId, scriptId, machineIds.size(), initiatedBy);
        return saved;
    }

    private Execution buildRunningRow(String executionId,
                                      String scriptId,
                                      String machineId,
                                      PrivilegeLevel privilegeLevel,
                                      String initiatedBy,
                                      Instant now) {
        return Execution.builder()
                .tenantId(tenantIdProvider.getTenantId())
                .executionId(executionId)
                .scriptId(scriptId)
                .machineId(machineId)
                .privilegeLevel(privilegeLevel)
                .initiatedBy(initiatedBy)
                .status(ExecutionStatus.RUNNING)
                .dispatchedAt(now)
                .statusChangedAt(now)
                .build();
    }

    /**
     * Cursor-paginated executions for a single script in the current tenant —
     * backs the Script Details → Execution History tab. Default sort {@code _id}
     * DESC (newest first). Cursor is the raw {@code ObjectId} hex of the
     * boundary row; an invalid cursor is logged and treated as "no cursor"
     * (returns first page rather than a 500).
     */
    public CountedGenericQueryResult<ExecutionResponse> list(String scriptId,
                                                             SortInput sort,
                                                             CursorPaginationCriteria pagination) {
        String tenantId = tenantIdProvider.getTenantId();
        CursorPaginationCriteria normalized = pagination.normalize();
        int limit = normalized.getLimit();

        String sortField = resolveSortField(sort);
        Sort.Direction sortDirection = resolveSortDirection(sort);

        Criteria base = Criteria.where(FIELD_TENANT_ID).is(tenantId)
                .and(FIELD_SCRIPT_ID).is(scriptId);
        long filteredCount = mongoTemplate.count(new Query(base), Execution.class);

        Criteria paged = Criteria.where(FIELD_TENANT_ID).is(tenantId)
                .and(FIELD_SCRIPT_ID).is(scriptId);
        applyCursor(paged, normalized.getCursor(), normalized.isBackward(), sortDirection);

        Sort.Direction effectiveDir = normalized.isBackward() ? flip(sortDirection) : sortDirection;
        Query query = new Query(paged)
                .with(Sort.by(effectiveDir, sortField))
                .limit(limit + 1);
        List<Execution> page = mongoTemplate.find(query, Execution.class);

        boolean hasMore = page.size() > limit;
        List<Execution> items = hasMore ? page.subList(0, limit) : page;
        if (normalized.isBackward()) {
            items = items.reversed();
        }

        List<ExecutionResponse> views = items.stream().map(executionMapper::toResponse).toList();
        return CountedGenericQueryResult.<ExecutionResponse>builder()
                .items(views)
                .pageInfo(buildPageInfo(views, hasMore, normalized))
                .filteredCount((int) filteredCount)
                .build();
    }

    private static String resolveSortField(SortInput sort) {
        if (sort == null || sort.getField() == null || sort.getField().isBlank()) {
            return FIELD_ID;
        }
        String requested = sort.getField().trim();
        if (!SORTABLE_FIELDS.contains(requested)) {
            log.warn("Invalid sort field requested for executions: '{}' — falling back to {}", requested, FIELD_ID);
            return FIELD_ID;
        }
        return requested;
    }

    private static Sort.Direction resolveSortDirection(SortInput sort) {
        if (sort != null && sort.getDirection() == SortDirection.ASC) {
            return Sort.Direction.ASC;
        }
        return Sort.Direction.DESC;
    }

    /**
     * Apply the cursor predicate. For forward + DESC: {@code _id < cursor}.
     * For forward + ASC: {@code _id > cursor}. {@code backward=true} flips
     * the comparator on the same cursor value (handles {@code before/last}
     * paging while keeping the cursor itself a single boundary id).
     */
    private static void applyCursor(Criteria criteria, String cursor, boolean backward, Sort.Direction direction) {
        if (cursor == null || cursor.isBlank()) {
            return;
        }
        ObjectId cursorId;
        try {
            cursorId = new ObjectId(cursor);
        } catch (IllegalArgumentException e) {
            log.warn("Invalid execution cursor '{}' — treating as first page", cursor);
            return;
        }
        boolean descending = direction == Sort.Direction.DESC;
        boolean strictlyLess = descending ^ backward;
        if (strictlyLess) {
            criteria.and(FIELD_ID).lt(cursorId);
        } else {
            criteria.and(FIELD_ID).gt(cursorId);
        }
    }

    private static Sort.Direction flip(Sort.Direction direction) {
        return direction == Sort.Direction.DESC ? Sort.Direction.ASC : Sort.Direction.DESC;
    }

    private static PageInfo buildPageInfo(List<ExecutionResponse> views, boolean hasMore, CursorPaginationCriteria pagination) {
        boolean hasPrev;
        boolean hasNext;
        if (pagination.isBackward()) {
            hasPrev = hasMore;
            hasNext = pagination.getCursor() != null;
        } else {
            hasPrev = pagination.getCursor() != null;
            hasNext = hasMore;
        }
        String startCursor = views.isEmpty() ? null : CursorCodec.encode(views.get(0).getId());
        String endCursor = views.isEmpty() ? null : CursorCodec.encode(views.get(views.size() - 1).getId());
        return PageInfo.builder()
                .hasNextPage(hasNext)
                .hasPreviousPage(hasPrev)
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
    }
}
