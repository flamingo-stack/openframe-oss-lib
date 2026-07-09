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

    List<ScriptSchedule> findPageForTenant(String tenantId,
                                           ScriptScheduleQueryFilter filter,
                                           String search,
                                           String sortField,
                                           Sort.Direction sortDirection,
                                           String cursor,
                                           boolean backward,
                                           int limit);

    long countForTenant(String tenantId, ScriptScheduleQueryFilter filter, String search);

    Map<String, Integer> platformFacet(String tenantId, ScriptScheduleQueryFilter filter);

    Map<String, Integer> authorFacet(String tenantId, ScriptScheduleQueryFilter filter);

    boolean isSortableField(String field);

    String getDefaultSortField();
}
