package com.openframe.external.dto.knowledgebase;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
@Schema(description = "Rename folder request")
public class RenameFolderRequest {

    @NotBlank(message = "Name is required")
    @Size(max = 255)
    @Schema(description = "New folder name", requiredMode = Schema.RequiredMode.REQUIRED)
    private final String name;
}
