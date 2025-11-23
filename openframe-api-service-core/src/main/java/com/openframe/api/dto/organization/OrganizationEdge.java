package com.openframe.api.dto.organization;

import com.openframe.data.document.organization.Organization;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrganizationEdge {
    private Organization node;
    private String cursor;
}
