package com.openframe.data.document.tag;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "tag_assignments")
@CompoundIndexes({
        @CompoundIndex(name = "tenant_entity_tag_idx", def = "{'tenantId': 1, 'entityId': 1, 'tagId': 1, 'entityType': 1}", unique = true)
})
public class TagAssignment implements TenantScoped {
    @Id
    private String id;

    @Indexed
    private String tenantId;

    private String entityId;
    private String tagId;
    private TagEntityType entityType;

    /**
     * Per-device values for the tag key (e.g., ["site1", "site2"] for key "site").
     * Empty list for simple label tags with no values.
     */
    private List<String> values;

    private Instant taggedAt;
    private String taggedBy;
}