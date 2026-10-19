package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.filter.ExecutionFacetField;
import com.openframe.data.document.rmm.filter.ExecutionOwnerScope;
import com.openframe.data.document.rmm.filter.ScriptExecutionQueryFilter;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.script.ScriptExecution;
import org.springframework.data.domain.Sort;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;

// Owner-scoped (per-script / per-schedule) execution queries share one API; see CustomScriptExecutionRepositoryImpl.
public interface CustomScriptExecutionRepository {

    List<ScriptExecution> saveRunning(RunningExecutionRows request);

    List<ScriptExecution> saveQueued(RunningExecutionRows request);

    Optional<ScriptExecution> findByMachineIdAndExecutionIdAndScriptId(String machineId, String executionId, String scriptId);

    List<ScriptExecution> findByMachineIdAndExecutionIdAndScriptIdIn(String machineId, String executionId, Collection<String> scriptIds);

    // Cursor pagination: cursor is the raw _id hex of the previous page's boundary row; backward=true walks the
    // opposite direction (caller reverses for display); pass limit + 1 to detect additional pages.
    List<ScriptExecution> findPage(String tenantId,
                                   ExecutionOwnerScope owner,
                                   ScriptExecutionQueryFilter filter,
                                   String sortField,
                                   Sort.Direction sortDirection,
                                   String cursor,
                                   boolean backward,
                                   int limit,
                                   String search);

    // Full matching count ignoring pagination, backing the connection's filteredCount.
    long count(String tenantId, ExecutionOwnerScope owner, ScriptExecutionQueryFilter filter, String search);

    // Faceted value -> matching count, excluding the facet's own filter field so its dropdown stays switchable.
    Map<String, Integer> facet(String tenantId,
                               ExecutionOwnerScope owner,
                               ScriptExecutionQueryFilter filter,
                               String search,
                               ExecutionFacetField facet);

    // Whether the given field is allowed as a sort key.
    boolean isSortableField(String field);

    // Default sort field when none is supplied.
    String getDefaultSortField();

    // Encodes the compound-keyset cursor for a page boundary row, consumed by findPage on the next request.
    String encodeCursor(ScriptExecution row, String sortField);

    // Single $match + $group pass backing the header aggregator's "any leaf still running/failed?" decision.
    LeafStatusCounts countLeavesByStatus(String tenantId, String executionId);

    // inProgress = not-yet-terminal leaves (QUEUED or RUNNING); header stays open while inProgress > 0.
    record LeafStatusCounts(long inProgress, long failed) {}
}
