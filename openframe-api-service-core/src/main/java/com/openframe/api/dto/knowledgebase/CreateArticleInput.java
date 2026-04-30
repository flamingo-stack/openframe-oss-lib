package com.openframe.api.dto.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateArticleInput {
    @NotBlank
    private String name;
    private String parentId;
    private String content;
    private String summary;
    private KnowledgeBaseArticleStatus status;

    @Size(max = 50)
    private List<String> assignedOrganizationIds;
    @Size(max = 50)
    private List<String> assignedDeviceIds;
    @Size(max = 50)
    private List<String> assignedTicketIds;
    @Size(max = 50)
    private List<String> assignedKnowledgeArticleIds;
}
