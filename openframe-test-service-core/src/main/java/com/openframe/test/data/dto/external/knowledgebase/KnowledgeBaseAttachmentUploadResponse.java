package com.openframe.test.data.dto.external.knowledgebase;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Attachment record plus the signed URL to upload the file bytes to
 *
 * <p>Generated from the OpenFrame External API OpenAPI contract ({@code GET /api-docs}), version 1.1.0.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class KnowledgeBaseAttachmentUploadResponse {

    private KnowledgeBaseAttachmentResponse attachment;

    /** Short-lived signed URL; PUT the bytes to it with the declared Content-Type. */
    private String uploadUrl;
}
