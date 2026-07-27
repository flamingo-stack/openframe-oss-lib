package com.openframe.api.dto.rmm.schedulerun;

import com.openframe.data.document.rmm.ExecutionStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * API-layer filter for the "Schedule Runs" list.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScheduleRunFilterInput {

    /** Match fires whose {@code status} is in this set. {@code null}/empty = no status constraint. */
    private List<ExecutionStatus> statuses;

    /** Inclusive lower bound on the fire's {@code dispatchedAt}. Backs the date-range picker's start. */
    private Instant dispatchedAtFrom;

    /** Inclusive upper bound on the fire's {@code dispatchedAt}. Backs the date-range picker's end. */
    private Instant dispatchedAtTo;
}
