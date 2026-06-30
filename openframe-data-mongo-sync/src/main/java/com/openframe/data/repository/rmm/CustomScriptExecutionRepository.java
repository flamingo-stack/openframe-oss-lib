package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.filter.ScriptExecutionQueryFilter;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.Map;

/**
 * Custom MongoTemplate-backed queries for {@link ScriptExecution}.
 *
 * <p>Spring Data derived methods cannot express id-cursor pagination, so the
 * per-script History list query lives here rather than in the service —
 * mirrors {@link CustomScriptRepository}. Implementation:
 * {@code CustomScriptExecutionRepositoryImpl}.
 */
public interface CustomScriptExecutionRepository {

    /**
     * Fetch a single page of execution rows for one script within a tenant.
     * Always tenant-scoped (predicate is {@code tenantId + scriptId}).
     *
     * <p>Cursor semantics: the cursor is the raw {@code ObjectId} hex from the
     * boundary row of the previous page. With {@code backward=true} the scan
     * walks in the opposite direction so that paging "before" a cursor returns
     * the rows immediately newer than it; the caller is expected to reverse the
     * returned list for display.
     *
     * <p>Pass {@code limit + 1} from the caller to detect whether more pages
     * exist beyond this one (the canonical "fetch one extra" trick).
     *
     * @param tenantId tenant scope — required, never null
     * @param scriptId the script whose executions are listed — required
     * @param filter optional extra constraints (e.g. statuses); {@code null} or
     *        empty fields impose no constraint
     * @param sortField sort field, must be one of {@link #isSortableField}
     * @param sortDirection sort direction
     * @param cursor raw {@code _id} cursor (already base64-decoded); {@code null}
     *        means "first page"
     * @param backward {@code true} when paginating with {@code before/last}
     * @param limit max rows to return (usually {@code pageSize + 1})
     * @param search optional case-insensitive substring matched across
     *        {@code executionId}, {@code machineId}, {@code stdout} and
     *        {@code stderr}; {@code null}/blank imposes no constraint
     */
    List<ScriptExecution> findPageForScript(String tenantId,
                                            String scriptId,
                                            ScriptExecutionQueryFilter filter,
                                            String sortField,
                                            Sort.Direction sortDirection,
                                            String cursor,
                                            boolean backward,
                                            int limit,
                                            String search);

    /**
     * Count all execution rows for the given script (and {@code filter}) in the
     * tenant, ignoring pagination (no cursor / limit). Backs the connection's
     * {@code filteredCount} so the UI can show the full total immediately while
     * items load page by page.
     */
    long countForScript(String tenantId, String scriptId, ScriptExecutionQueryFilter filter, String search);

    /**
     * Faceted "Executed by" options for one script's Execution History:
     * {@code initiatedBy user id → matching-execution-count}. Applies the OTHER active
     * constraints (statuses, machineIds, search) but NOT {@code initiatedByIds} (its own
     * field), so the dropdown keeps offering every initiator. Labels are resolved by the
     * service. Mirrors the script {@code authorFacet}.
     */
    Map<String, Integer> initiatorFacet(String tenantId, String scriptId, ScriptExecutionQueryFilter filter, String search);

    /** Whether the given field is allowed as a sort key. */
    boolean isSortableField(String field);

    /** Default sort field when none is supplied. */
    String getDefaultSortField();
}
