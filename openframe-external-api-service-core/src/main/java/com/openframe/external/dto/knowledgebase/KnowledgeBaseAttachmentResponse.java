package com.openframe.external.dto.knowledgebase;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Knowledge base attachment metadata")
public class KnowledgeBaseAttachmentResponse {

    @Schema(description = "Attachment ID")
    private String id;

    @Schema(description = "Article ID the attachment belongs to")
    private String itemId;

    @Schema(description = "Original file name")
    private String fileName;

    @Schema(description = "MIME type")
    private String contentType;

    @Schema(description = "File size in bytes")
    private Long fileSize;

    @Schema(description = "Uploader user ID")
    private String uploadedBy;

    private Instant createdAt;
}
