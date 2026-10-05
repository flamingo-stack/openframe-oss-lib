package com.openframe.test.data.dto.external.knowledgebase;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.openframe.test.data.dto.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.test.data.dto.knowledgebase.KnowledgeBaseItemType;

import java.time.Instant;
import java.util.List;

// Knowledge base item, a folder or an article; from the External API OpenAPI contract (GET /api-docs), v1.1.0.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class KnowledgeBaseItemResponse {

    private String id;

    private KnowledgeBaseItemType type;

    private String name;

    // Null at the root.
    private String parentId;

    private String slug;

    private Integer sortOrder;

    // Articles only, and omitted from list responses: read a single item to get it.
    private String content;

    private String summary;

    // Null for folders.
    private KnowledgeBaseArticleStatus status;

    // Stamped on the first publish and never overwritten afterwards.
    private Instant publishedAt;

    private String createdBy;

    private String lastModifiedBy;

    private Instant createdAt;

    private Instant updatedAt;

    private List<KnowledgeBaseTagResponse> tags;

    // Metadata only.
    private List<KnowledgeBaseAttachmentResponse> attachments;
}
