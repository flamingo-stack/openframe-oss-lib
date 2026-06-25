package com.openframe.api.service.rmm;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.execution.ScriptExecutionResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.ScriptExecutionMapper;
import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.ScriptExecutionStatus;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

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
public class ScriptExecutionService {

    private final ScriptExecutionRepository scriptExecutionRepository;
    private final TenantIdProvider tenantIdProvider;
    private final ScriptExecutionMapper scriptExecutionMapper;

    /**
     * Persist a new {@link ScriptExecution} row in {@link ScriptExecutionStatus#RUNNING}
     * state immediately before the dispatch is published on NATS.
     *
     * <p>Only {@code scriptId} is stored — the script's display name is resolved
     * at read time (GraphQL {@code Execution.scriptName} field resolver), so a
     * later rename of the source {@code Script} is reflected in History without
     * duplicating the name onto every row.
     */
    public ScriptExecution create(String executionId,
                                  String scriptId,
                                  String machineId,
                                  PrivilegeLevel privilegeLevel,
                                  Integer timeoutSeconds,
                                  String initiatedBy) {
        Instant now = Instant.now();
        ScriptExecution scriptExecution = buildRunningRow(executionId, scriptId, machineId, privilegeLevel, timeoutSeconds, initiatedBy, now);
        ScriptExecution saved = scriptExecutionRepository.save(scriptExecution);
        log.info("Persisted execution row: executionId={} scriptId={} machineId={} initiatedBy={} status=RUNNING",
                executionId, scriptId, machineId, initiatedBy);
        return saved;
    }

    /**
     * Bulk-persist one {@link ScriptExecutionStatus#RUNNING} row per target machine
     * under a shared {@code executionId} — backs batch dispatch. Unique
     * constraint is {@code (tenantId, executionId, machineId)}, so the same
     * {@code executionId} repeats across rows while each {@code machineId}
     * stays distinct.
     */
    public List<ScriptExecution> createBatch(String executionId,
                                             String scriptId,
                                             List<String> machineIds,
                                             PrivilegeLevel privilegeLevel,
                                             Integer timeoutSeconds,
                                             String initiatedBy) {
        Instant now = Instant.now();
        List<ScriptExecution> rows = machineIds.stream()
                .map(machineId -> buildRunningRow(executionId, scriptId, machineId, privilegeLevel, timeoutSeconds, initiatedBy, now))
                .toList();
        List<ScriptExecution> saved = scriptExecutionRepository.saveAll(rows);
        log.info("Persisted batch execution rows: executionId={} scriptId={} machineCount={} initiatedBy={} status=RUNNING",
                executionId, scriptId, machineIds.size(), initiatedBy);
        return saved;
    }

    private ScriptExecution buildRunningRow(String executionId,
                                            String scriptId,
                                            String machineId,
                                            PrivilegeLevel privilegeLevel,
                                            Integer timeoutSeconds,
                                            String initiatedBy,
                                            Instant now) {
        return ScriptExecution.builder()
                .tenantId(tenantIdProvider.getTenantId())
                .executionId(executionId)
                .scriptId(scriptId)
                .machineId(machineId)
                .privilegeLevel(privilegeLevel)
                .timeoutSeconds(timeoutSeconds)
                .initiatedBy(initiatedBy)
                .status(ScriptExecutionStatus.RUNNING)
                .dispatchedAt(now)
                .statusChangedAt(now)
                .build();
    }

    /**
     * Cursor-paginated executions for a single script in the current tenant —
     * backs the Script Details → Execution History tab. Default sort {@code _id}
     * DESC (newest first).
     *
     * <p>This method only orchestrates: resolve tenant + sort, then fetch the
     * count and one page (the {@code limit + 1} "fetch one extra" trick) from
     * {@code CustomScriptExecutionRepository}, and assemble the connection
     * envelope. The {@code Criteria}/cursor/sort query assembly — including
     * invalid-cursor fallback — lives in the repository, not here.
     */
    public CountedGenericQueryResult<ScriptExecutionResponse> list(String scriptId,
                                                                   SortInput sort,
                                                                   CursorPaginationCriteria pagination) {
        String tenantId = tenantIdProvider.getTenantId();
        CursorPaginationCriteria normalized = pagination.normalize();
        int limit = normalized.getLimit();

        String sortField = resolveSortField(sort);
        Sort.Direction sortDirection = resolveSortDirection(sort);

        long filteredCount = scriptExecutionRepository.countForScript(tenantId, scriptId);

        List<ScriptExecution> page = scriptExecutionRepository.findPageForScript(
                tenantId, scriptId, sortField, sortDirection,
                normalized.getCursor(), normalized.isBackward(), limit + 1);

        boolean hasMore = page.size() > limit;
        List<ScriptExecution> items = hasMore ? page.subList(0, limit) : page;
        if (normalized.isBackward()) {
            items = items.reversed();
        }

        List<ScriptExecutionResponse> views = items.stream().map(scriptExecutionMapper::toResponse).toList();
        return CountedGenericQueryResult.<ScriptExecutionResponse>builder()
                .items(views)
                .pageInfo(buildPageInfo(views, hasMore, normalized))
                .filteredCount((int) filteredCount)
                .build();
    }

    private String resolveSortField(SortInput sort) {
        if (sort == null || sort.getField() == null || sort.getField().isBlank()) {
            return scriptExecutionRepository.getDefaultSortField();
        }
        String requested = sort.getField().trim();
        if (!scriptExecutionRepository.isSortableField(requested)) {
            log.warn("Invalid sort field requested for executions: '{}' — falling back to default", requested);
            return scriptExecutionRepository.getDefaultSortField();
        }
        return requested;
    }

    private static Sort.Direction resolveSortDirection(SortInput sort) {
        if (sort != null && sort.getDirection() == SortDirection.ASC) {
            return Sort.Direction.ASC;
        }
        return Sort.Direction.DESC;
    }

    private static PageInfo buildPageInfo(List<ScriptExecutionResponse> views, boolean hasMore, CursorPaginationCriteria pagination) {
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
