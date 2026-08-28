package com.openframe.test.data.dto.external.organization;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.openframe.test.data.dto.external.common.PageInfo;
import java.util.List;

/**
 * Paginated list of organizations
 *
 * <p>Generated from the OpenFrame External API OpenAPI contract ({@code GET /api-docs}), version 1.1.0.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrganizationsResponse {

    private List<OrganizationResponse> organizations;

    private Integer total;

    private Integer filteredCount;

    private PageInfo pageInfo;
}
