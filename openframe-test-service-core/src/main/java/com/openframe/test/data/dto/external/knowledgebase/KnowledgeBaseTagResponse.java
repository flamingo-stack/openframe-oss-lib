package com.openframe.test.data.dto.external.knowledgebase;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

// Knowledge base tag; from the External API OpenAPI contract (GET /api-docs), v1.1.0.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class KnowledgeBaseTagResponse {

    private String id;

    private String key;

    private String description;

    private String color;

    private Instant createdAt;

    private String createdBy;
}
