package com.openframe.external.dto.knowledgebase;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Declare a file to attach to an article; the bytes are then uploaded to the returned signed URL")
public class CreateKnowledgeBaseAttachmentRequest {
        @NotBlank(message = "File name is required")
        @Size(max = 255)
        @Schema(description = "Original file name", requiredMode = Schema.RequiredMode.REQUIRED)
        private String fileName;

        @Schema(description = "MIME type (defaults to application/octet-stream)")
        private String contentType;

        @NotNull(message = "File size is required")
        @Positive(message = "File size must be positive")
        @Schema(description = "File size in bytes", requiredMode = Schema.RequiredMode.REQUIRED)
        private Long fileSize;
}
