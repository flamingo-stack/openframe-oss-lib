package com.openframe.data.document.rmm.filter;

import com.openframe.data.document.rmm.ExecutionStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Data-layer filter criteria for {@code ScriptExecution} queries. Mirrors the
 * API-layer {@code ScriptExecutionFilterInput} but lives here so the repository
 * stays dependency-free of the API module. The service maps between the two.
 *
 * <p>Mirrors the {@code ScriptQueryFilter} pattern.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptExecutionQueryFilter {

    /** Match executions whose {@code status} is ANY of these. {@code null}/empty = no status constraint. */
    private List<ExecutionStatus> statuses;

    /** Match executions whose {@code initiatedBy} (initiator user id) is ANY of these. {@code null}/empty = no constraint. */
    private List<String> initiatedByIds;

    /** Match executions whose {@code machineId} is ANY of these. {@code null}/empty = no constraint. */
    private List<String> machineIds;

    /** Inclusive lower bound on {@code dispatchedAt}. {@code null} = no lower bound. Mirrors the Logs {@code timestampFrom} pattern. */
    private Instant dispatchedAtFrom;

    /** Inclusive upper bound on {@code dispatchedAt}. {@code null} = no upper bound. Mirrors the Logs {@code timestampTo} pattern. */
    private Instant dispatchedAtTo;
}
