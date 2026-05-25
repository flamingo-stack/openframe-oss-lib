package com.openframe.test.data.dto.knowledgebase;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UpdateArticleInput {
    private String id;
    private String name;
    private String parentId;
    private String content;
    private String summary;
}
