package com.openframe.api.dto.timetracking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Aggregate stats for the Employee Work Time block.
 * All durations are in seconds; the UI formats to HH:MM:SS.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeTimeStats {
    private long todayTotalSeconds;
    private long todayEntryCount;
    private long periodTotalSeconds;
    private long periodEntryCount;
    /**
     * periodTotalSeconds / number of distinct active days in the period.
     * Zero when no days had any tracked time.
     */
    private long averagePerDaySeconds;
}
