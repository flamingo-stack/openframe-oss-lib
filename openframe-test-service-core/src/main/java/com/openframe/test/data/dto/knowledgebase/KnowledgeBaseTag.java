package com.openframe.test.data.dto.knowledgebase;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class KnowledgeBaseTag {
    private String id;
    private String key;
    private String description;
    private String color;
    private List<String> values;
    private TagEntityType entityType;
    private String createdAt;
}
