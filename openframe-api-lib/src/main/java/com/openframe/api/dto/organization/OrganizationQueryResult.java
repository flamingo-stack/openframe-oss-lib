package com.openframe.api.dto.organization;

import com.openframe.api.dto.shared.CursorPageInfo;
import com.openframe.data.document.organization.Organization;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrganizationQueryResult {
    private List<Organization> organizations;
    private CursorPageInfo pageInfo;
    private int filteredCount;
}
