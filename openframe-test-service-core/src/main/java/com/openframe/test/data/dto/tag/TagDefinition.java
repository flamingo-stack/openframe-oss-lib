package com.openframe.test.data.dto.tag;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * A tag key definition shared across entity types (DEVICE, TICKET, KNOWLEDGE_ARTICLE) — the
 * GraphQL {@code Tag} type. Named {@code TagDefinition} to avoid clashing with JUnit's {@code @Tag}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TagDefinition {
    private String id;
    private String key;
    private String description;
    private String color;
    private List<String> values;
    private String entityType;
    private String createdAt;
}
