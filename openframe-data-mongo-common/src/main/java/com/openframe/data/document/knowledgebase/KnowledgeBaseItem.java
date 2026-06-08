package com.openframe.data.document.knowledgebase;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "knowledge_base_items")
@CompoundIndexes({
    @CompoundIndex(name = "tenant_parent_type_sort", def = "{'tenantId': 1, 'parentId': 1, 'type': 1, 'sortOrder': 1}"),
    @CompoundIndex(name = "tenant_type_status", def = "{'tenantId': 1, 'type': 1, 'status': 1}")
})
public class KnowledgeBaseItem implements TenantScoped {
    @Id
    private String id;

    private String tenantId;

    @Indexed
    private KnowledgeBaseItemType type;

    private String name;

    @Indexed
    private String parentId;

    private String slug;

    private Integer sortOrder;

    private String content;

    private String summary;

    @Indexed
    private KnowledgeBaseArticleStatus status;

    private Instant publishedAt;

    private String createdBy;

    @CreatedDate
    private Instant createdAt;

    private String lastModifiedBy;

    @LastModifiedDate
    private Instant updatedAt;
}
