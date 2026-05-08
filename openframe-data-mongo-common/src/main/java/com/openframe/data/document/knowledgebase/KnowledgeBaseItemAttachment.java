package com.openframe.data.document.knowledgebase;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "knowledge_base_item_attachments")
public class KnowledgeBaseItemAttachment {
    @Id
    private String id;

    @Indexed
    private String itemId;

    private String fileName;

    private String storagePath;

    private Long fileSize;

    private String contentType;

    private String uploadedBy;

    @CreatedDate
    private Instant createdAt;
}
