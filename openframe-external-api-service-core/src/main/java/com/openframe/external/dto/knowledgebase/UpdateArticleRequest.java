package com.openframe.external.dto.knowledgebase;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Update article request; only non-null fields are applied")
public class UpdateArticleRequest {

        @Size(max = 255)
        @Schema(description = "New name")
        private String name;

        @Schema(description = "Folder id to move the article into")
        private String parentId;

        @Schema(description = "New markdown content")
        private String content;

        @Size(max = 1000)
        @Schema(description = "New summary")
        private String summary;
}

