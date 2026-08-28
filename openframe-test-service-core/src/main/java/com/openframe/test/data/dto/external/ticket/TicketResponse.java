package com.openframe.test.data.dto.external.ticket;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Ticket
 *
 * <p>Generated from the OpenFrame External API OpenAPI contract ({@code GET /api-docs}), version 1.1.0.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TicketResponse {

    private String id;

    private Integer ticketNumber;

    private String title;

    private String description;

    /** Contract values: ACTIVE, TECH_REQUIRED, ON_HOLD, RESOLVED, ARCHIVED. Kept as String so a new backend value deserializes rather than throwing. */
    private String status;

    /** Contract values: AI_ASSISTANCE, TECH_REQUIRED, RESOLVED, ARCHIVED, CUSTOM. Kept as String so a new backend value deserializes rather than throwing. */
    private String statusKind;

    private TicketStatusResponse statusDefinition;

    private List<TicketStatusResponse> availableTransitions;

    /** Contract values: FAE_FORM, FAE_DIALOG, ADMIN_DASHBOARD. Kept as String so a new backend value deserializes rather than throwing. */
    private String creationSource;

    private TicketOwnerResponse owner;

    private String deviceId;

    private String deviceHostname;

    private String organizationId;

    private String organizationName;

    private String reporterId;

    private String reporterName;

    private String assignedTo;

    private String assignedName;

    private Boolean escalatedByUser;

    private Boolean aiDisabled;

    private List<TicketTagResponse> tags;

    private List<TicketAttachmentResponse> attachments;

    private List<TicketNoteResponse> notes;

    private String order;

    private Instant createdAt;

    private Instant updatedAt;

    private Instant resolvedAt;

    /** Contract values: TECHNICIAN, END_USER, AI_AGENT. Kept as String so a new backend value deserializes rather than throwing. */
    private String resolvedBy;

    private String resolvedByName;

    private Integer reopenCount;
}
