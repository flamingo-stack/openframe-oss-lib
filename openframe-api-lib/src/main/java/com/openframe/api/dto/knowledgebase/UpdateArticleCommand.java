package com.openframe.api.dto.knowledgebase;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateArticleCommand {
    private String id;
    private String name;
    private String parentId;
    private String content;
    private String summary;
}
