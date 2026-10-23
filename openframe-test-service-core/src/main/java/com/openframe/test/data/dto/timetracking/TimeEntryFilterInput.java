package com.openframe.test.data.dto.timetracking;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Filter for {@code employeeTimeEntries} / {@code employeeTimeStats}: employee and organization ids
 * are Relay global ids (decoded server-side); the period is {@code [startedFrom, startedTo)}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TimeEntryFilterInput {
    private List<String> employeeIds;
    private List<String> organizationIds;
    private String startedFrom;
    private String startedTo;
}
