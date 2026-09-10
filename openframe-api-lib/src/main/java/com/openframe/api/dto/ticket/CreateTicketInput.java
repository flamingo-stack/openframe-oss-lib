package com.openframe.api.dto.ticket;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Create-ticket command (dashboard GraphQL input and external REST request both map onto it). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateTicketInput {
    @NotBlank
    @Size(max = 255)
    private String title;
    @Size(max = 5000)
    private String description;
    /** Lifecycle feature: initial custom status for manually created tickets (defaults to first custom). */
    private String statusId;
    private String deviceId;
    private String organizationId;
    private String assigneeId;
    @Size(max = 20)
    private List<String> tagIds;
    //TODO Backward compatibility alias. Remove after FE alignment
    @Deprecated
    private List<String> labelIds;
    @Size(max = 20)
    private List<String> tempAttachmentIds;
    @Size(max = 50)
    private List<String> assignedOrganizationIds;
    @Size(max = 50)
    private List<String> assignedDeviceIds;
    @Size(max = 50)
    private List<String> assignedTicketIds;
    @Size(max = 50)
    private List<String> assignedKnowledgeArticleIds;
}
