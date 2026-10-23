package com.openframe.external.dto.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Knowledge base item: a folder or an article")
public class KnowledgeBaseItemResponse {

    @Schema(description = "Item ID", example = "66f1c2a9e4b0a1b2c3d4e5f6")
    private String id;

    @Schema(description = "FOLDER or ARTICLE")
    private KnowledgeBaseItemType type;

    @Schema(description = "Folder or article name")
    private String name;

    @Schema(description = "Parent folder id (null at the root)")
    private String parentId;

    @Schema(description = "URL slug")
    private String slug;

    @Schema(description = "Manual ordering rank among siblings")
    private Integer sortOrder;

    @Schema(description = "Markdown content (articles only; omitted in list responses, read a single item to get it)")
    private String content;

    @Schema(description = "Short summary (articles only)")
    private String summary;

    @Schema(description = "Article status: DRAFT, PUBLISHED or ARCHIVED (null for folders)")
    private KnowledgeBaseArticleStatus status;

    @Schema(description = "When the article was first published")
    private Instant publishedAt;

    @Schema(description = "User ID of the creator")
    private String createdBy;

    @Schema(description = "User ID of the last editor")
    private String lastModifiedBy;

    @Schema(description = "Creation timestamp")
    private Instant createdAt;

    @Schema(description = "Last update timestamp")
    private Instant updatedAt;

    @Schema(description = "Tags assigned to the item")
    private List<KnowledgeBaseTagResponse> tags;

    @Schema(description = "File attachments (metadata only)")
    private List<KnowledgeBaseAttachmentResponse> attachments;
}
