package com.openframe.data.document.knowledgebase;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Inline image embedded in markdown content (Knowledge Base articles, ticket descriptions).
 * Unlike {@link KnowledgeBaseItemAttachment}, images are not bound to an item: they are
 * uploaded while the content is still being written and referenced by a permanent URL
 * ({@code /knowledge-base/images/{id}}), so they must survive item lifecycle changes.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "knowledge_base_images")
public class KnowledgeBaseImage implements TenantScoped {
    @Id
    private String id;

    @Indexed
    private String tenantId;

    private String fileName;

    private String storagePath;

    private Long fileSize;

    private String contentType;

    private String uploadedBy;

    @CreatedDate
    private Instant createdAt;
}
