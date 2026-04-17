package com.openframe.data.document.knowledgebase;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "knowledge_base_item_tag_assignments")
@CompoundIndex(name = "item_tag_unique", def = "{'itemId': 1, 'tagId': 1}", unique = true)
public class KnowledgeBaseItemTagAssignment {
    @Id
    private String id;

    @Indexed
    private String itemId;

    @Indexed
    private String tagId;

    @CreatedDate
    private Instant createdAt;
}
