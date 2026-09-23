package com.openframe.external.dto.knowledgebase;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
@Schema(description = "Move an item into another folder")
public class MoveKnowledgeBaseItemRequest {

    @Schema(description = "Target folder id; null moves the item to the root")
    private final String parentId;
}
