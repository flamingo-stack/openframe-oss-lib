package com.openframe.external.dto.knowledgebase;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

@Schema(description = "Declare a file to attach to an article; the bytes are then uploaded to the returned signed URL")
public record CreateKnowledgeBaseAttachmentRequest(
        @NotBlank(message = "File name is required")
        @Schema(description = "Original file name", requiredMode = Schema.RequiredMode.REQUIRED)
        String fileName,

        @Schema(description = "MIME type (defaults to application/octet-stream)")
        String contentType,

        @NotNull(message = "File size is required")
        @Positive(message = "File size must be positive")
        @Schema(description = "File size in bytes", requiredMode = Schema.RequiredMode.REQUIRED)
        Long fileSize
) {
}
