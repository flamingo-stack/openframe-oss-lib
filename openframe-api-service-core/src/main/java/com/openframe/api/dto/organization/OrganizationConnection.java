package com.openframe.api.dto.organization;

import com.openframe.api.dto.shared.CursorPageInfo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrganizationConnection {
    private List<OrganizationEdge> edges;
    private CursorPageInfo pageInfo;
    private int filteredCount;
}
