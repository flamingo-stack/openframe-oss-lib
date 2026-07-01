package com.openframe.api.dto.rmm.execution;

import com.openframe.data.document.rmm.ExecutionStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * API-layer filter for the Script Execution History list. Mirrors
 * {@code ScriptFilterInput}; the service maps it to the data-layer
 * {@code ScriptExecutionQueryFilter}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptExecutionFilterInput {

    /** Match executions whose {@code status} is in this set. {@code null}/empty = no status constraint. */
    private List<ExecutionStatus> statuses;

    /** Match executions initiated by ANY of these users — raw {@code initiatedBy} ids (not Relay-encoded). */
    private List<String> initiatorIds;

    /** Match executions whose target device {@code machineId} is ANY of these — raw machine ids (not Relay-encoded). {@code null}/empty = no constraint. */
    private List<String> machineIds;
}
