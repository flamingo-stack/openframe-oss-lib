package com.openframe.external.dto.knowledgebase;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Schema(description = "Attachment record plus the signed URL to upload the file bytes to")
public class KnowledgeBaseAttachmentUploadResponse {
        @Schema(description = "Attachment metadata as stored")
        private KnowledgeBaseAttachmentResponse attachment;

        @Schema(description = "Short-lived signed URL; PUT the file bytes to it with the declared Content-Type")
        private String uploadUrl;
}

