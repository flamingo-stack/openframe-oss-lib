package com.openframe.external.dto.knowledgebase;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Attachment record plus the signed URL to upload the file bytes to")
public record KnowledgeBaseAttachmentUploadResponse(
        @Schema(description = "Attachment metadata as stored")
        KnowledgeBaseAttachmentResponse attachment,

        @Schema(description = "Short-lived signed URL; PUT the file bytes to it with the declared Content-Type")
        String uploadUrl
) {
}
