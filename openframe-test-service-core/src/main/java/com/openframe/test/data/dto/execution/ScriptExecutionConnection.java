package com.openframe.test.data.dto.execution;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.shared.PageInfo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Page of {@code scriptExecutions} / {@code scheduleExecutions}. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScriptExecutionConnection {
    private List<ScriptExecutionEdge> edges;
    private PageInfo pageInfo;
    private Integer filteredCount;

    public List<ScriptExecution> nodes() {
        return edges == null ? List.of() : edges.stream().map(ScriptExecutionEdge::getNode).toList();
    }
}
