package com.openframe.external.dto.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

@Schema(description = "Create article request")
public record CreateArticleRequest(
        @NotBlank(message = "Name is required")
        @Size(max = 255)
        @Schema(description = "Article name", requiredMode = Schema.RequiredMode.REQUIRED)
        String name,

        @Schema(description = "Parent folder id; omit to create at the root")
        String parentId,

        @Schema(description = "Markdown content")
        String content,

        @Size(max = 1000)
        @Schema(description = "Short summary")
        String summary,

        @Schema(description = "Initial status: DRAFT (default) or PUBLISHED")
        KnowledgeBaseArticleStatus status,

        @Size(max = 50)
        @Schema(description = "Tag ids to assign (see GET /api/v1/knowledge-base/tags)")
        List<String> tagIds,

        @Size(max = 50)
        @Schema(description = "Customer ids to assign the article to")
        List<String> assignedCustomerIds,

        @Size(max = 50)
        @Schema(description = "Device machineIds to assign the article to")
        List<String> assignedDeviceIds,

        @Size(max = 50)
        @Schema(description = "Ticket ids to assign the article to")
        List<String> assignedTicketIds,

        @Size(max = 50)
        @Schema(description = "Related article ids")
        List<String> assignedArticleIds
) {
}
