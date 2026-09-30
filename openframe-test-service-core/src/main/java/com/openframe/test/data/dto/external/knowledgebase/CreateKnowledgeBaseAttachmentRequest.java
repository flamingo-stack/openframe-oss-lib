package com.openframe.test.data.dto.external.knowledgebase;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// Declares a file to attach to an article (its bytes go to the returned signed URL); from the External API OpenAPI contract (GET /api-docs), v1.1.0.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CreateKnowledgeBaseAttachmentRequest {

    // Required by the contract.
    private String fileName;

    // Defaults to application/octet-stream.
    private String contentType;

    // Required and positive.
    private Long fileSize;
}
