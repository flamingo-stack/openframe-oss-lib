package com.openframe.data.document.timetracking.filter;

import com.openframe.data.document.timetracking.TimeEntrySource;
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
public class TimeEntryQueryFilter {

    private List<String> userIds;
    private List<String> ticketIds;
    private List<String> organizationIds;
    private List<TimeEntrySource> sources;
    private Instant startedFrom;
    private Instant startedTo;
    private TimeEntryStateFilter state;
    private String search;
}
