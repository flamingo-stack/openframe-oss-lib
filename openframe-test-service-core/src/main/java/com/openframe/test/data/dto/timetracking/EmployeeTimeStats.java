package com.openframe.test.data.dto.timetracking;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Totals returned by {@code employeeTimeStats(filter)}: today and the filtered period. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class EmployeeTimeStats {
    private Long todayTotalSeconds;
    private Long todayEntryCount;
    private Long periodTotalSeconds;
    private Long periodEntryCount;
    private Long averagePerDaySeconds;
}
