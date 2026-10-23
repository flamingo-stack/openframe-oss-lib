package com.openframe.test.data.dto.schedule;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.shared.PageInfo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Relay connection returned by {@code scriptSchedules(...)}. {@code filteredCount} is the number of
 * schedules matching the filter/search for the tenant, independent of pagination.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScriptScheduleConnection {
    private List<ScriptScheduleEdge> edges;
    private PageInfo pageInfo;
    private Integer filteredCount;

    public List<ScriptSchedule> nodes() {
        return edges == null ? List.of() : edges.stream().map(ScriptScheduleEdge::getNode).toList();
    }
}
