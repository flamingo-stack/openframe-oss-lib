package com.openframe.test.data.dto.ticket;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Partial update for {@code updateTicket}: omitted fields keep their stored value;
 * {@code tempAttachmentIds} links staged uploads to the ticket.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UpdateTicketInput {
    private String id;
    private String title;
    private String description;
    private String deviceId;
    private String organizationId;
    private String assigneeId;
    private List<String> tagIds;
    private List<String> tempAttachmentIds;
}
