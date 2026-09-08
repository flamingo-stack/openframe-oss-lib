package com.openframe.api.dto.ticket;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateTicketInput {
    @NotBlank
    private String id;
    private String title;
    private String description;
    private String deviceId;
    private String organizationId;
    private String assigneeId;
    private List<String> tagIds;
    //TODO Backward compatibility alias. Remove after FE alignment
    @Deprecated
    private List<String> labelIds;
    private List<String> tempAttachmentIds;
}
