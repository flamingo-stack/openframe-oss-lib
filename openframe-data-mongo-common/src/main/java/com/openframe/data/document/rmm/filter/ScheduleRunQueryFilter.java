package com.openframe.data.document.rmm.filter;

import com.openframe.data.document.rmm.ExecutionStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Data-layer filter criteria for {@code ScheduleScriptExecution} (Schedule Runs list)
 * queries. Mirrors the API-layer {@code ScheduleRunFilterInput}; kept in the data module
 * so the repository stays dependency-free of the API module.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScheduleRunQueryFilter {

    /** Match fires whose {@code status} is ANY of these. {@code null}/empty = no status constraint. */
    private List<ExecutionStatus> statuses;

    /** Inclusive lower bound on {@code dispatchedAt}. {@code null} = no lower bound. */
    private Instant dispatchedAtFrom;

    /** Inclusive upper bound on {@code dispatchedAt}. {@code null} = no upper bound. */
    private Instant dispatchedAtTo;
}
