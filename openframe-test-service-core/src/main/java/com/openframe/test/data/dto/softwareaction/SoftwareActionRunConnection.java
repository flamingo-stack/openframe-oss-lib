package com.openframe.test.data.dto.softwareaction;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.shared.PageInfo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// A page of softwareActions, newest first.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class SoftwareActionRunConnection {
    private List<SoftwareActionRunEdge> edges;
    private PageInfo pageInfo;
    private Integer filteredCount;

    public List<SoftwareActionRun> nodes() {
        return edges == null ? List.of() : edges.stream().map(SoftwareActionRunEdge::getNode).toList();
    }
}
