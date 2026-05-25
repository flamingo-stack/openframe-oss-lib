package com.openframe.test.data.dto.knowledgebase;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CreateArticleInput {
    private String name;
    private String parentId;
    private String content;
    private String summary;
    private KnowledgeBaseArticleStatus status;
    private List<String> tagIds;
    private List<String> assignedOrganizationIds;
    private List<String> assignedDeviceIds;
    private List<String> assignedTicketIds;
    private List<String> assignedKnowledgeArticleIds;
}
