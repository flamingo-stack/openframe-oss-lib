package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.filter.ScriptScheduleQueryFilter;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.Map;

/**
 * Custom MongoTemplate-backed queries for {@link ScriptSchedule}.
 *
 * <p>Cursor pagination and arbitrary filter + search + sort live here rather
 * than as Spring Data derived methods. Implementation:
 * {@code CustomScriptScheduleRepositoryImpl}. Mirrors
 * {@link CustomScriptRepository} (minus the shell/tag facets).
 */
public interface CustomScriptScheduleRepository {

    /**
     * Fetch a single page of schedules within a tenant with optional filter,
     * search, and sort. Always tenant-scoped. Cursor is the raw {@code _id} hex
     * of the previous page's boundary; pass {@code limit + 1} to detect further
     * pages ("fetch one extra"). {@code backward=true} walks the opposite
     * direction (caller reverses the list for display).
     */
    List<ScriptSchedule> findPageForTenant(String tenantId,
                                           ScriptScheduleQueryFilter filter,
                                           String search,
                                           String sortField,
                                           Sort.Direction sortDirection,
                                           String cursor,
                                           boolean backward,
                                           int limit);

    /**
     * Count all schedules matching tenant + filter + search, ignoring pagination.
     * Backs the connection's {@code filteredCount}.
     */
    long countForTenant(String tenantId, ScriptScheduleQueryFilter filter, String search);

    /**
     * Platform facet — {@code supportedPlatforms} is an array, so it is unwound
     * before grouping. Applies the OTHER active filters but not its own field.
     */
    Map<String, Integer> platformFacet(String tenantId, ScriptScheduleQueryFilter filter);

    /** Author facet — distinct {@code createdBy} user ids (labels resolved by the service). */
    Map<String, Integer> authorFacet(String tenantId, ScriptScheduleQueryFilter filter);

    /** Whether the given field is allowed as a sort key. */
    boolean isSortableField(String field);

    /** Default sort field when none is supplied. */
    String getDefaultSortField();
}
