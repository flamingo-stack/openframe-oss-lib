package com.openframe.external.dto.knowledgebase;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Create folder request")
public record CreateFolderRequest(
        @NotBlank(message = "Name is required")
        @Size(max = 255)
        @Schema(description = "Folder name", requiredMode = Schema.RequiredMode.REQUIRED)
        String name,

        @Schema(description = "Parent folder id; omit to create at the root")
        String parentId
) {
}
