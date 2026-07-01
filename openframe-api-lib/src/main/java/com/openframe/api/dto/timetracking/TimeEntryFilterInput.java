package com.openframe.api.dto.timetracking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TimeEntryFilterInput {
    private List<String> employeeIds;
    private List<String> organizationIds;
    private Instant startedFrom;
    private Instant startedTo;
}
