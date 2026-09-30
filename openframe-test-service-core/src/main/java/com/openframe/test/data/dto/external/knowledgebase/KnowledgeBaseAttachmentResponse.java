package com.openframe.test.data.dto.external.knowledgebase;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

// Knowledge base attachment metadata; from the External API OpenAPI contract (GET /api-docs), v1.1.0.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class KnowledgeBaseAttachmentResponse {

    private String id;

    // The article the attachment belongs to.
    private String itemId;

    private String fileName;

    private String contentType;

    private Long fileSize;

    private String uploadedBy;

    private Instant createdAt;
}
