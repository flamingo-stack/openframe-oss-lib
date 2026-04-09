package com.openframe.data.document.tag;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "tags")
@CompoundIndexes({
        @CompoundIndex(name = "key_org_idx", def = "{'key': 1, 'organizationId': 1}", unique = true)
})
public class Tag {
    @Id
    private String id;

    /**
     * Tag key identifier (e.g., "site", "org_type", "primary_msp").
     * Unique per organization (compound index with organizationId).
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

    private String organizationId;  // scope tags to organizations
    private Instant createdAt;
    private String createdBy;
}
