package com.openframe.external.dto.knowledgebase;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

@Schema(description = "Update article request; only non-null fields are applied")
public record UpdateArticleRequest(
        @Size(max = 255)
        @Schema(description = "New name")
        String name,

        @Schema(description = "Folder id to move the article into")
        String parentId,

        @Schema(description = "New markdown content")
        String content,

        @Size(max = 1000)
        @Schema(description = "New summary")
        String summary
) {
}
