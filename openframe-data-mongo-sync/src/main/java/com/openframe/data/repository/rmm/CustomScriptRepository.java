package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.Script;

import java.util.List;

/**
 * Custom MongoTemplate-backed queries for {@link Script}.
 *
 * <p>Spring Data derived methods cannot express id-cursor pagination, so the
 * cursor query lives here. Implementation: {@code CustomScriptRepositoryImpl}.
 */
public interface CustomScriptRepository {

    /**
     * Fetch a single page of scripts within a tenant, sorted by {@code _id}.
     *
     * <p>Default order is newest-first ({@code _id} DESC). With {@code backward=true}
     * the underlying scan walks in the opposite direction so that paging "before"
     * a cursor returns the rows immediately newer than it; the caller is
     * expected to reverse the returned list for display.
     *
     * <p>Pass {@code limit + 1} from the caller to detect whether more pages
     * exist beyond this one (the canonical "fetch one extra" trick).
     *
     * @param tenantId tenant scope — required, never null
     * @param cursor raw {@code _id} cursor (already decoded from the opaque
     *        client cursor); {@code null} means "first page"
     * @param backward {@code true} when paginating with {@code before/last}
     * @param limit max rows to return (usually {@code pageSize + 1})
     */
    List<Script> findPageForTenant(String tenantId, String cursor, boolean backward, int limit);
}
