package com.openframe.test.data.dto.packagesearch;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.shared.PageInfo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// Relay connection returned by searchPackages; forward pagination only.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class PackageSearchConnection {
    private List<PackageSearchEdge> edges;
    private PageInfo pageInfo;
    private Integer filteredCount;

    public List<PackageSearchItem> nodes() {
        return edges == null ? List.of() : edges.stream().map(PackageSearchEdge::getNode).toList();
    }

    public List<String> ids() {
        return nodes().stream().map(PackageSearchItem::getId).toList();
    }
}
