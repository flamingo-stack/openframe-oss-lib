package com.openframe.test.data.dto.knowledgebase;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class KnowledgeBaseItem {
    private String id;
    private KnowledgeBaseItemType type;
    private String name;
    private String parentId;
    private String slug;
    private Integer sortOrder;
    private KnowledgeBaseArticleStatus status;
    private String summary;
    private String content;
    private String publishedAt;
    private String createdBy;
    private String createdAt;
    private String lastModifiedBy;
    private String updatedAt;
    private KnowledgeBaseAuthor author;
    private List<KnowledgeBaseTag> tags;
    private List<KnowledgeBaseItemAttachment> attachments;
}
