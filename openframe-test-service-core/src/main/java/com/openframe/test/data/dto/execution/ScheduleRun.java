package com.openframe.test.data.dto.execution;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** One fire of a schedule to its assigned devices ({@code script-schedule-run.graphqls}). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScheduleRun {
    private String id;
    private String executionId;
    private String scheduleId;
    private String status;
    private Integer totalMachineCount;
    private Integer respondedMachineCount;
    private String dispatchedAt;
    private String finishedAt;
}
