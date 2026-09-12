package com.openframe.external.dto.knowledgebase;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Signed download link for an attachment")
public record KnowledgeBaseAttachmentDownloadResponse(
        @Schema(description = "Short-lived signed URL to GET the file bytes from")
        String downloadUrl
) {
}
