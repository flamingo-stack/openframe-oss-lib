package com.openframe.external.dto.knowledgebase;

import com.openframe.api.dto.shared.PageInfo;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Paginated list of knowledge base items")
public class KnowledgeBaseItemsResponse {

    @Schema(description = "Items on the current page (folders first, then articles)")
    private List<KnowledgeBaseItemResponse> items;

    @Schema(description = "Pagination information (opaque cursors)")
    private PageInfo pageInfo;

    @Schema(description = "Total count of items matching the filter")
    private Integer filteredCount;
}
