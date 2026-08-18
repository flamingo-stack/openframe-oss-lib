package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.filter.ExecutionFacetField;
import com.openframe.data.document.rmm.filter.ExecutionOwnerScope;
import com.openframe.data.document.rmm.filter.ScriptExecutionQueryFilter;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Custom MongoTemplate-backed queries for {@link ScriptExecution}. Owner-scoped —
 * both per-script (Script → Execution History tab) and per-schedule (Schedule →
 * Execution History tab) queries share one API, differing only in {@link ExecutionOwnerScope}.
 *
 * <p>Spring Data derived methods cannot express id-cursor pagination + facet aggregations
 * over shared predicate variations, so the list / count / facet queries live here rather
 * than in the service — mirrors {@code CustomScriptRepository}. Implementation:
 * {@code CustomScriptExecutionRepositoryImpl}.
 */
public interface CustomScriptExecutionRepository {

    Optional<ScriptExecution> findByMachineIdAndExecutionIdAndScriptId(String machineId, String executionId, String scriptId);

    /**
     * Cursor-paginated executions for one owner (script or schedule) within a tenant.
     *
     * <p>Cursor semantics: the cursor is the raw {@code ObjectId} hex from the boundary
     * row of the previous page. With {@code backward=true} the scan walks in the
     * opposite direction so paging "before" a cursor returns the rows immediately newer
     * than it; the caller is expected to reverse the returned list for display.
     *
     * <p>Pass {@code limit + 1} from the caller to detect whether more pages exist
     * beyond this one (the canonical "fetch one extra" trick).
     *
     * @param tenantId tenant scope — required, never null
     * @param owner    what narrows the base predicate — see {@link ExecutionOwnerScope}
     * @param filter   optional extra constraints (statuses/initiators/machines); null / empty
     *                 fields impose no constraint
     * @param sortField     sort field, must satisfy {@link #isSortableField}
     * @param sortDirection sort direction
     * @param cursor        raw {@code _id} cursor (already base64-decoded); null = first page
     * @param backward      true when paginating with {@code before/last}
     * @param limit         max rows to return (usually {@code pageSize + 1})
     * @param search        optional case-insensitive substring matched across
     *                      {@code executionId}, {@code machineId}, {@code stdout},
     *                      {@code stderr}; null/blank imposes no constraint
     */
    List<ScriptExecution> findPage(String tenantId,
                                   ExecutionOwnerScope owner,
                                   ScriptExecutionQueryFilter filter,
                                   String sortField,
                                   Sort.Direction sortDirection,
                                   String cursor,
                                   boolean backward,
                                   int limit,
                                   String search);

    /**
     * Full matching count for the {@code (tenantId, owner, filter, search)} tuple, ignoring
     * pagination. Backs the connection's {@code filteredCount} so the UI can show the full
     * total immediately while items load page by page.
     */
    long count(String tenantId, ExecutionOwnerScope owner, ScriptExecutionQueryFilter filter, String search);

    /**
     * Faceted options for one owner's Execution History: {@code value → matching count}.
     * Applies every filter arm EXCEPT the facet's own field, so its dropdown keeps offering
     * every switchable value. Labels are resolved by the service.
     */
    Map<String, Integer> facet(String tenantId,
                               ExecutionOwnerScope owner,
                               ScriptExecutionQueryFilter filter,
                               String search,
                               ExecutionFacetField facet);

    /** Whether the given field is allowed as a sort key. */
    boolean isSortableField(String field);

    /** Default sort field when none is supplied. */
    String getDefaultSortField();

    /**
     * Encode the compound-keyset cursor for a page boundary row: {@code <sortValue>|<hexId>}
     * for non-{@code _id} sort fields (empty {@code sortValue} for null Instant), or the plain
     * hex {@code _id} for {@code _id} sort. Consumed by {@link #findPage} on the next request.
     */
    String encodeCursor(com.openframe.data.document.rmm.ScriptExecution row, String sortField);

    /**
     * Count leaf {@link ScriptExecution} rows for one schedule fire, grouped by status.
     * A single {@code $match + $group} pass — one round-trip — backs the header aggregator
     * so it can decide "any leaf still running? any failed?" without loading the rows
     * themselves. Tenant-scoped so it hits the compound index.
     */
    LeafStatusCounts countLeavesByStatus(String tenantId, String executionId);

    /** Running/failed counts for the leaves of one schedule fire; other terminal statuses are irrelevant to the decision. */
    record LeafStatusCounts(long running, long failed) {}
}
