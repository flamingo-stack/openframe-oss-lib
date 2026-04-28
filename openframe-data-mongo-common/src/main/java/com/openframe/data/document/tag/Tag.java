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
@Document(collection = "tags")
@CompoundIndexes({
        @CompoundIndex(name = "tenant_key_entity_idx", def = "{'tenantId': 1, 'key': 1, 'entityType': 1}", unique = true)
})
public class Tag implements TenantScoped {
    @Id
    private String id;

    @Indexed
    private String tenantId;

    /**
     * Tag key identifier (e.g., "site", "org_type", "primary_msp").
     * Unique per entity type across the whole tenant (compound index with entityType).
     */
    private String key;

    private String description;
    private String color;  // Optional

    /**
     * Predefined allowed values for this tag key (e.g., ["CHICAGO", "SCHOOL1"] for key "site").
     * Null means a simple label tag or free-text input (no predefined options).
     * Empty list means values were explicitly cleared.
     * UI behavior: if values is non-null and non-empty → show dropdown/checkboxes; otherwise → free-text input.
     */
    private List<String> values;

    private TagEntityType entityType;

    private Instant createdAt;
    private String createdBy;
}
