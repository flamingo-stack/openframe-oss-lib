package com.openframe.test.data.dto.execution;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.shared.PageInfo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScheduleRunConnection {
    private List<ScheduleRunEdge> edges;
    private PageInfo pageInfo;
    private Integer filteredCount;

    public List<ScheduleRun> nodes() {
        return edges == null ? List.of() : edges.stream().map(ScheduleRunEdge::getNode).toList();
    }
}
