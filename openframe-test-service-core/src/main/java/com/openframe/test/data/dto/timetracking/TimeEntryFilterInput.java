package com.openframe.test.data.dto.timetracking;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Filter for {@code employeeTimeEntries} / {@code employeeTimeStats}: employee and organization ids
 * are Relay global ids (decoded server-side); the period is {@code [startedFrom, startedTo)}
 * i.e. a half-open interval where {@link #startedFrom} is inclusive and {@link #startedTo} is
 * exclusive. Implementations consuming this filter MUST treat {@code startedTo} as an exclusive
 * upper bound (e.g. {@code startedAt >= startedFrom AND startedAt < startedTo}) to avoid off-by-one
 * errors (double counting or dropping the last instant of a period) in time tracking stats.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TimeEntryFilterInput {
    private List<String> employeeIds;
    private List<String> organizationIds;
    /** Inclusive lower bound of the period. */
    private String startedFrom;
    /** Exclusive upper bound of the period. */
    private String startedTo;
}
