package com.openframe.external.dto.knowledgebase;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Move an item into another folder")
public record MoveKnowledgeBaseItemRequest(
        @Schema(description = "Target folder id; null moves the item to the root")
        String parentId
) {
}
