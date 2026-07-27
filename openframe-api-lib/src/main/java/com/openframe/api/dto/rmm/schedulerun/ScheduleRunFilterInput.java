package com.openframe.api.dto.rmm.schedulerun;

import com.openframe.data.document.rmm.ExecutionStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * API-layer filter for the "Schedule Runs" list. Currently only status; add more
 * (initiator, date range, …) as the UI grows.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScheduleRunFilterInput {

    /** Match fires whose {@code status} is in this set. {@code null}/empty = no status constraint. */
    private List<ExecutionStatus> statuses;
}
