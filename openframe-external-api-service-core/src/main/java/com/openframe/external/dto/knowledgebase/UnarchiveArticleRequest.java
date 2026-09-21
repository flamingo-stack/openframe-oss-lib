package com.openframe.external.dto.knowledgebase;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Restore an archived article into a folder")
public record UnarchiveArticleRequest(
        @Schema(description = "Folder id to restore the article into; null restores it at the root")
        String parentId
) {
}
