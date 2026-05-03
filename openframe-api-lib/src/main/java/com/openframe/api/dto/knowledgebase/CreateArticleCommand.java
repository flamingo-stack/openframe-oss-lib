package com.openframe.api.dto.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateArticleCommand {
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
