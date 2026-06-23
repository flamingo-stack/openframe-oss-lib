package com.openframe.test.data.dto.ticket;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class Ticket {
    private String id;
    private Integer ticketNumber;
    private String title;
    private String description;
    private String status;
    private TicketStatusDefinition statusDefinition;
    private String creationSource;
    private TicketOwner owner;
    private String deviceId;
    private String deviceHostname;
    private String organizationId;
    private String organizationName;
    private TicketImage organizationImage;
    private String assignedTo;
    private String assignedName;
    private TicketImage assigneeImage;
    private List<TicketLabel> labels;
    private TicketDialog dialog;
    private List<TicketAttachment> attachments;
    private List<TicketNote> notes;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant resolvedAt;
    private String order;
}
