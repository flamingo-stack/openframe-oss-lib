package com.openframe.test.data.dto.external.knowledgebase;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Declare a file to attach to an article; the bytes then go to the returned signed URL
 *
 * <p>Generated from the OpenFrame External API OpenAPI contract ({@code GET /api-docs}), version 1.1.0.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CreateKnowledgeBaseAttachmentRequest {

    /** Required by the contract. */
    private String fileName;

    /** Defaults to application/octet-stream. */
    private String contentType;

    /** Required and positive. */
    private Long fileSize;
}
