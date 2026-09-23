package com.openframe.external.dto.knowledgebase;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
@Schema(description = "Restore an archived article into a folder")
public class UnarchiveArticleRequest {

    @Schema(description = "Folder id to restore the article into; null restores it at the root")
    private String parentId;
}

