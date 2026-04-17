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

/**
 * Tags for Knowledge Base articles.
 * Used as filter chips in the KB list view.
 *
 * Examples: TROUBLESHOOTING, INSTALLATION, CONFIGURATION, BEST-PRACTICES, etc.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "knowledge_base_tags")
public class KnowledgeBaseTag {
    @Id
    private String id;

    @Indexed(unique = true)
    private String name;

    /**
     * Optional color for tag chip display.
     */
    private String color;

    @CreatedDate
    private Instant createdAt;

    private String createdBy;
}
