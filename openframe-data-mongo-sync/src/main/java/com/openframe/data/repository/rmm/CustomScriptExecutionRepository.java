package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.filter.ExecutionFacetField;
import com.openframe.data.document.rmm.filter.ExecutionOwnerScope;
import com.openframe.data.document.rmm.filter.ScriptExecutionQueryFilter;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.Map;

/**
 * Custom MongoTemplate-backed queries for {@link ScriptExecution}. Owner-scoped —
 * both per-script (Script → Execution History tab) and per-schedule (Schedule →
 * Execution History tab) queries share one API, differing only in {@link ExecutionOwnerScope}.
 */
public interface CustomScriptExecutionRepository {

    void applyResult(ScriptExecution row);

    List<ScriptExecution> findPage(String tenantId,
                                   ExecutionOwnerScope owner,
                                   ScriptExecutionQueryFilter filter,
                                   String sortField,
                                   Sort.Direction sortDirection,
                                   String cursor,
                                   boolean backward,
                                   int limit,
                                   String search);

    long count(String tenantId, ExecutionOwnerScope owner, ScriptExecutionQueryFilter filter, String search);

    Map<String, Integer> facet(String tenantId,
                               ExecutionOwnerScope owner,
                               ScriptExecutionQueryFilter filter,
                               String search,
                               ExecutionFacetField facet);

    boolean isSortableField(String field);

    String getDefaultSortField();

    String encodeCursor(com.openframe.data.document.rmm.ScriptExecution row, String sortField);

    LeafStatusCounts countLeavesByStatus(String tenantId, String executionId);

    record LeafStatusCounts(long running, long failed) {}
}
