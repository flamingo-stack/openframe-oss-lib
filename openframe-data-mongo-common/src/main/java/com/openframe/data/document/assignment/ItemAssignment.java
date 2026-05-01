package com.openframe.data.document.assignment;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "item_assignments")
@CompoundIndexes({
    @CompoundIndex(name = "item_target_unique", def = "{'itemId': 1, 'targetType': 1, 'targetId': 1}", unique = true),
    @CompoundIndex(name = "target_lookup", def = "{'targetType': 1, 'targetId': 1}")
})
public class ItemAssignment {
    @Id
    private String id;

    private String itemId;

    private AssignmentItemType itemType;

    private AssignmentTargetType targetType;

    @Indexed
    private String targetId;

    private String displayName;

    @CreatedDate
    private Instant createdAt;
}
