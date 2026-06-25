package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ScriptExecution;
import org.springframework.data.domain.Sort;

import java.util.List;

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
     * @param sortField sort field, must be one of {@link #isSortableField}
     * @param sortDirection sort direction
     * @param cursor raw {@code _id} cursor (already base64-decoded); {@code null}
     *        means "first page"
     * @param backward {@code true} when paginating with {@code before/last}
     * @param limit max rows to return (usually {@code pageSize + 1})
     */
    List<ScriptExecution> findPageForScript(String tenantId,
                                            String scriptId,
                                            String sortField,
                                            Sort.Direction sortDirection,
                                            String cursor,
                                            boolean backward,
                                            int limit);

    /**
     * Count all execution rows for the given script in the tenant, ignoring
     * pagination (no cursor / limit). Backs the connection's
     * {@code filteredCount} so the UI can show the full total immediately while
     * items load page by page.
     */
    long countForScript(String tenantId, String scriptId);

    /** Whether the given field is allowed as a sort key. */
    boolean isSortableField(String field);

    /** Default sort field when none is supplied. */
    String getDefaultSortField();
}
