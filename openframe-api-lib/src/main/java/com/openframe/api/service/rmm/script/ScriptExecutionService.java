package com.openframe.api.service.rmm.script;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.rmm.execution.ScriptExecutionFilterInput;
import com.openframe.api.dto.rmm.execution.ScriptExecutionResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.ScriptExecutionMapper;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.filter.ExecutionOwnerScope;
import com.openframe.data.document.rmm.filter.ScriptExecutionQueryFilter;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

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
     * Non-throwing lookup by the row's Mongo {@code _id} (tenant-scoped) — backs
     * Relay {@code node(id)} refetch, where the global id decodes to this raw id.
     * Empty for a missing / other-tenant row.
     */
    public Optional<ScriptExecutionResponse> findById(String id) {
        return scriptExecutionRepository
                .findByTenantIdAndId(tenantIdProvider.getTenantId(), id)
                .map(scriptExecutionMapper::toResponse);
    }

    public ScriptExecutionResponse get(String id) {
        return findById(id)
                .orElseThrow(() -> new NotFoundException("Script execution not found: " + id));
    }

    /**
     * Persist a new {@link ScriptExecution} row in {@link ExecutionStatus#RUNNING}
     * state immediately before the dispatch is published on NATS.
     *
     * <p>Only {@code scriptId} is stored — the script's display name is resolved
     * at read time (GraphQL {@code Execution.scriptName} field resolver), so a
     * later rename of the source {@code Script} is reflected in History without
     * duplicating the name onto every row.
     */
    public ScriptExecutionResponse create(String executionId,
                                          String scriptId,
                                          String machineId,
                                          PrivilegeLevel privilegeLevel,
                                          Integer timeoutSeconds,
                                          String initiatedBy,
                                          ExecutionSource source) {
        Instant now = Instant.now();
        // Single ad-hoc run (runScript) never originates from a schedule → scheduleId null.
        ScriptExecution scriptExecution = buildRunningRow(executionId, scriptId, null, machineId, privilegeLevel, timeoutSeconds, initiatedBy, source, now);
        ScriptExecution saved = scriptExecutionRepository.save(scriptExecution);
        log.info("Persisted execution row: executionId={} scriptId={} machineId={} initiatedBy={} source={} status=RUNNING",
                executionId, scriptId, machineId, initiatedBy, source);
        return scriptExecutionMapper.toResponse(saved);
    }

    /**
     * Bulk-persist one {@link ExecutionStatus#RUNNING} row per target machine
     * under a shared {@code executionId} — backs batch dispatch. Unique
     * constraint is {@code (tenantId, executionId, machineId, scriptId)}: the same
     * {@code executionId} repeats across rows (a schedule run shares it across all
     * its scripts too), with {@code machineId}/{@code scriptId} keeping each row
     * distinct.
     */
    public List<ScriptExecutionResponse> createBatch(String executionId,
                                                     String scriptId,
                                                     String scheduleId,
                                                     List<String> machineIds,
                                                     PrivilegeLevel privilegeLevel,
                                                     Integer timeoutSeconds,
                                                     String initiatedBy,
                                                     ExecutionSource source) {
        Instant now = Instant.now();
        List<ScriptExecution> rows = machineIds.stream()
                .map(machineId -> buildRunningRow(executionId, scriptId, scheduleId, machineId, privilegeLevel, timeoutSeconds, initiatedBy, source, now))
                .toList();
        List<ScriptExecution> saved = scriptExecutionRepository.saveAll(rows);
        log.info("Persisted batch execution rows: executionId={} scriptId={} scheduleId={} machineCount={} initiatedBy={} source={} status=RUNNING",
                executionId, scriptId, scheduleId, machineIds.size(), initiatedBy, source);
        return saved.stream().map(scriptExecutionMapper::toResponse).toList();
    }

    /**
     * Read back the current execution rows for a batch dispatch. Used in NativeBulkScriptRunner
     */
    public List<ScriptExecution> getBatchResults(String executionId, List<String> machineIds) {
        String tenantId = tenantIdProvider.getTenantId();
        return machineIds.stream()
                .map(machineId -> scriptExecutionRepository
                        .findByTenantIdAndExecutionIdAndMachineId(tenantId, executionId, machineId))
                .flatMap(Optional::stream)
                .toList();
    }

    private ScriptExecution buildRunningRow(String executionId,
                                            String scriptId,
                                            String scheduleId,
                                            String machineId,
                                            PrivilegeLevel privilegeLevel,
                                            Integer timeoutSeconds,
                                            String initiatedBy,
                                            ExecutionSource source,
                                            Instant now) {
        return ScriptExecution.builder()
                .tenantId(tenantIdProvider.getTenantId())
                .executionId(executionId)
                .scriptId(scriptId)
                .scheduleId(scheduleId)
                .machineId(machineId)
                .privilegeLevel(privilegeLevel)
                .timeoutSeconds(timeoutSeconds)
                .initiatedBy(initiatedBy)
                .source(source)
                .status(ExecutionStatus.RUNNING)
                .dispatchedAt(now)
                .statusChangedAt(now)
                .build();
    }

    /**
     * Cursor-paginated executions for one {@link ExecutionOwnerScope owner} — a saved
     * script (Script → Execution History tab) or a schedule (Schedule → Execution
     * History tab), same API and same shape. Default sort {@code _id} DESC (newest
     * first).
     *
     * <p>Orchestration only: resolve tenant + sort, translate API filter to data-layer
     * filter, fetch the count and one page (the {@code limit + 1} "fetch one extra"
     * trick), assemble the connection envelope. {@code Criteria} / cursor / sort query
     * assembly — including invalid-cursor fallback — lives in the repository.
     */
    public CountedGenericQueryResult<ScriptExecutionResponse> list(ExecutionOwnerScope owner,
                                                                   ScriptExecutionFilterInput filter,
                                                                   String search,
                                                                   SortInput sort,
                                                                   CursorPaginationCriteria pagination) {
        String tenantId = tenantIdProvider.getTenantId();
        CursorPaginationCriteria normalized = pagination.normalize();
        int limit = normalized.getLimit();

        String sortField = resolveSortField(sort);
        Sort.Direction sortDirection = resolveSortDirection(sort);
        ScriptExecutionQueryFilter queryFilter = toQueryFilter(filter);

        long filteredCount = scriptExecutionRepository.count(tenantId, owner, queryFilter, search);
        List<ScriptExecution> page = scriptExecutionRepository.findPage(tenantId, owner, queryFilter,
                sortField, sortDirection, normalized.getCursor(), normalized.isBackward(), limit + 1, search);

        boolean hasMore = page.size() > limit;
        List<ScriptExecution> items = hasMore ? page.subList(0, limit) : page;
        if (normalized.isBackward()) {
            items = items.reversed();
        }

        String startCursor = items.isEmpty() ? null
                : CursorCodec.encode(scriptExecutionRepository.encodeCursor(items.get(0), sortField));
        String endCursor = items.isEmpty() ? null
                : CursorCodec.encode(scriptExecutionRepository.encodeCursor(items.get(items.size() - 1), sortField));

        List<ScriptExecutionResponse> views = items.stream().map(scriptExecutionMapper::toResponse).toList();
        return CountedGenericQueryResult.<ScriptExecutionResponse>builder()
                .items(views)
                .pageInfo(buildPageInfo(startCursor, endCursor, hasMore, normalized))
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

    private static ScriptExecutionQueryFilter toQueryFilter(ScriptExecutionFilterInput input) {
        if (input == null) {
            return null;
        }
        return ScriptExecutionQueryFilter.builder()
                .statuses(input.getStatuses())
                .initiatedByIds(input.getInitiatorIds())
                .machineIds(input.getMachineIds())
                .dispatchedAtFrom(input.getDispatchedAtFrom())
                .dispatchedAtTo(input.getDispatchedAtTo())
                .build();
    }

    private static PageInfo buildPageInfo(String startCursor, String endCursor,
                                          boolean hasMore, CursorPaginationCriteria pagination) {
        boolean hasPrev;
        boolean hasNext;
        if (pagination.isBackward()) {
            hasPrev = hasMore;
            hasNext = pagination.getCursor() != null;
        } else {
            hasPrev = pagination.getCursor() != null;
            hasNext = hasMore;
        }
        return PageInfo.builder()
                .hasNextPage(hasNext)
                .hasPreviousPage(hasPrev)
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
    }
}
