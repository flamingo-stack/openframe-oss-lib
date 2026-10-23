package com.openframe.api.service.rmm.script;

import com.openframe.api.dto.rmm.execution.ScriptExecutionFilterInput;
import com.openframe.data.document.rmm.filter.ScriptExecutionQueryFilter;
import com.openframe.data.document.rmm.script.ExecutionSource;
import lombok.experimental.UtilityClass;

import java.util.List;

@UtilityClass
final class ScriptExecutionHistoryFilter {

    private static final List<ExecutionSource> HIDDEN_SOURCES = List.of(ExecutionSource.SYSTEM_BOOTSTRAP);

    static ScriptExecutionQueryFilter of(ScriptExecutionFilterInput input) {
        ScriptExecutionQueryFilter.ScriptExecutionQueryFilterBuilder builder = ScriptExecutionQueryFilter.builder()
                .excludedSources(HIDDEN_SOURCES)
                .excludeTestRuns(true);
        if (input == null) {
            return builder.build();
        }
        return builder
                .statuses(input.getStatuses())
                .initiatedByIds(input.getInitiatorIds())
                .machineIds(input.getMachineIds())
                .dispatchedAtFrom(input.getDispatchedAtFrom())
                .dispatchedAtTo(input.getDispatchedAtTo())
                .build();
    }
}
