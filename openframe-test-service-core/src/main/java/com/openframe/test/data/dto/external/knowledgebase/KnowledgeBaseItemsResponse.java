package com.openframe.test.data.dto.external.knowledgebase;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.openframe.test.data.dto.external.common.PageInfo;
import java.util.List;

// Paginated knowledge base items, folders first; from the External API OpenAPI contract (GET /api-docs), v1.1.0.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class KnowledgeBaseItemsResponse {

    private List<KnowledgeBaseItemResponse> items;

    private PageInfo pageInfo;

    private Integer filteredCount;
}
