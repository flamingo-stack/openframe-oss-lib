package com.openframe.external.dto.organization;

import com.openframe.api.dto.organization.OrganizationResponse;
import com.openframe.api.dto.shared.PageInfo;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response DTO for organization list in external REST API with pagination support.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Paginated list of organizations")
public class OrganizationsResponse {
    @Schema(description = "Organizations on the current page")
    private List<OrganizationResponse> organizations;
    @Schema(description = "Number of organizations on the current page (deprecated, use filteredCount for the total)", deprecated = true)
    private Integer total;
    @Schema(description = "Total count of organizations matching the filter")
    private Integer filteredCount;
    @Schema(description = "Pagination information")
    private PageInfo pageInfo;
}
