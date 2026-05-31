package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.Script;
import com.openframe.data.document.rmm.filter.ScriptQueryFilter;
import org.springframework.data.domain.Sort;

import java.util.List;

/**
 * Custom MongoTemplate-backed queries for {@link Script}.
 *
 * <p>Spring Data derived methods cannot express id-cursor pagination or
 * arbitrary filter + search + sort combinations, so the list query lives
 * here. Implementation: {@code CustomScriptRepositoryImpl}.
 */
public interface CustomScriptRepository {

    /**
     * Fetch a single page of scripts within a tenant with optional filter,
     * search, and sort. Always tenant-scoped.
     *
     * <p>Cursor semantics: the cursor is the raw {@code ObjectId} hex from the
     * boundary script of the previous page. With {@code backward=true} the
     * underlying scan walks in the opposite direction so that paging "before"
     * a cursor returns the rows immediately newer than it; the caller is
     * expected to reverse the returned list for display.
     *
     * <p>Pass {@code limit + 1} from the caller to detect whether more pages
     * exist beyond this one (the canonical "fetch one extra" trick).
     *
     * @param tenantId tenant scope — required, never null
     * @param filter optional filter ({@code null} = no extra constraints; the
     *        default DELETED-exclusion still applies)
     * @param search optional regex substring matched against {@code name}
     *        (case-insensitive); {@code null} or blank means no search
     * @param sortField sort field, must be one of {@link #isSortableField}
     * @param sortDirection sort direction
     * @param cursor raw {@code _id} cursor (already base64-decoded); {@code null}
     *        means "first page"
     * @param backward {@code true} when paginating with {@code before/last}
     * @param limit max rows to return (usually {@code pageSize + 1})
     */
    List<Script> findPageForTenant(String tenantId,
                                   ScriptQueryFilter filter,
                                   String search,
                                   String sortField,
                                   Sort.Direction sortDirection,
                                   String cursor,
                                   boolean backward,
                                   int limit);

    /** Whether the given field is allowed as a sort key. */
    boolean isSortableField(String field);

    /** Default sort field when none is supplied. */
    String getDefaultSortField();
}
