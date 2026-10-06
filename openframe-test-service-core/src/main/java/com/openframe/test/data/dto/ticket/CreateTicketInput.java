package com.openframe.test.data.dto.ticket;

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
public class CreateTicketInput {
    private String title;
    private String description;
    private String organizationId;
    private String deviceId;
    private String assigneeId;
    private List<String> tagIds;
    private List<String> tempAttachmentIds;
}

