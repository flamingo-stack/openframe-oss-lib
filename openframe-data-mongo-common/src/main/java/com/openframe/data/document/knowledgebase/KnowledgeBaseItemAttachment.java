package com.openframe.data.document.knowledgebase;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "knowledge_base_item_attachments")
@CompoundIndexes({
    @CompoundIndex(name = "tenant_item_idx", def = "{'tenantId': 1, 'itemId': 1}")
})
public class KnowledgeBaseItemAttachment implements TenantScoped {
    @Id
    private String id;

    private String tenantId;

    private String itemId;

    private String fileName;

    private String storagePath;

    private Long fileSize;

    private String contentType;

    private String uploadedBy;

    @CreatedDate
    private Instant createdAt;
}
