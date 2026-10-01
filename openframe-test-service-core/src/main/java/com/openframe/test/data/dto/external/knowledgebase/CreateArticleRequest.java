package com.openframe.test.data.dto.external.knowledgebase;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// Create article request (lands as DRAFT unless a status is given); from the External API contract v1.1.0, trimmed to the fields the suite sends.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CreateArticleRequest {

    // Required by the contract; at most 255 characters.
    private String name;

    // Omit to create at the root.
    private String parentId;

    // Markdown.
    private String content;

    private String summary;
}
