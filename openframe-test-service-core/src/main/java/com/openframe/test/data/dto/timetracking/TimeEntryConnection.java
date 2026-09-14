package com.openframe.test.data.dto.timetracking;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.shared.PageInfo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Relay connection returned by {@code myTimeEntries} and {@code employeeTimeEntries}. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TimeEntryConnection {
    private List<TimeEntryEdge> edges;
    private PageInfo pageInfo;
    private Integer filteredCount;

    public List<TimeEntry> nodes() {
        return edges == null ? List.of() : edges.stream().map(TimeEntryEdge::getNode).toList();
    }

    public List<String> ids() {
        return nodes().stream().map(TimeEntry::getId).toList();
    }
}
