package com.openframe.api.dto.packagesearch;

import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.shared.PageInfo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PackageSearchConnection {

    private List<GenericEdge<PackageSearchItem>> edges;
    private PageInfo pageInfo;
    private Integer filteredCount;
}
