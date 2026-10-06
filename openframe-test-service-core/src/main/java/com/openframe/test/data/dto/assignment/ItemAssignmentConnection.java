package com.openframe.test.data.dto.assignment;

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
public class ItemAssignmentConnection {
    private List<ItemAssignmentEdge> edges;
    private PageInfo pageInfo;
    private Integer filteredCount;

    public List<ItemAssignment> nodes() {
        return edges == null ? List.of() : edges.stream().map(ItemAssignmentEdge::getNode).toList();
    }

    public List<String> targetIds() {
        return nodes().stream().map(node -> node.getTarget() == null ? null : node.getTarget().getId()).toList();
    }
}
