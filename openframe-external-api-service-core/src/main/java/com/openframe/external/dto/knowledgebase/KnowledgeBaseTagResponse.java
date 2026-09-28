package com.openframe.external.dto.knowledgebase;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Knowledge base tag")
public class KnowledgeBaseTagResponse {

    @Schema(description = "Tag ID")
    private String id;

    @Schema(description = "Tag key", example = "onboarding")
    private String key;

    @Schema(description = "Tag description")
    private String description;

    @Schema(description = "Tag color (hex)", example = "#FF5733")
    private String color;

    private Instant createdAt;

    @Schema(description = "User ID who created the tag")
    private String createdBy;
}
