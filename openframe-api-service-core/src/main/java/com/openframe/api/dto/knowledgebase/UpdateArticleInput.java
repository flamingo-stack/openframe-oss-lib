package com.openframe.api.dto.knowledgebase;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateArticleInput {
    @NotBlank
    private String id;
    private String name;
    private String parentId;
    private String content;
    private String summary;
}
