package com.openframe.test.data.dto.ticket;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CreateTicketInput {
    private String title;
    private String description;
    private String organizationId;
    private String deviceId;
    private String assigneeId;
    private List<String> labelIds;
    private List<String> tempAttachmentIds;
}
