package com.openframe.external.dto.ticket;

import com.openframe.data.document.ticket.TicketCreationSource;
import com.openframe.data.document.ticket.TicketResolver;
import com.openframe.data.document.ticket.TicketStatus;
import com.openframe.data.document.ticket.TicketStatusKind;
import io.swagger.v3.oas.annotations.media.Schema;
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
@Schema(description = "Ticket")
public class TicketResponse {

    @Schema(description = "Ticket ID", example = "66f1c2a9e4b0a1b2c3d4e5f6")
    private String id;

    @Schema(description = "Human-readable sequential ticket number (unique per tenant)", example = "1042")
    private Integer ticketNumber;

    @Schema(description = "Ticket title")
    private String title;

    @Schema(description = "Ticket description")
    private String description;

    @Schema(description = "Legacy status (populated only on tenants without the custom-status lifecycle)")
    private TicketStatus status;

    @Schema(description = "Kind of the current lifecycle status (AI_ASSISTANCE, TECH_REQUIRED, RESOLVED, ARCHIVED or CUSTOM)")
    private TicketStatusKind statusKind;

    @Schema(description = "Current lifecycle status definition")
    private TicketStatusResponse statusDefinition;

    @Schema(description = "Statuses this ticket may be transitioned to right now (single-ticket reads only; null in list responses). Use their ids with the transition endpoint.")
    private List<TicketStatusResponse> availableTransitions;

    @Schema(description = "How the ticket was created")
    private TicketCreationSource creationSource;

    @Schema(description = "Who opened the ticket: an end user's device (CLIENT) or an admin (ADMIN)")
    private TicketOwnerResponse owner;

    @Schema(description = "Linked device machineId")
    private String deviceId;

    @Schema(description = "Linked device hostname (denormalized)")
    private String deviceHostname;

    @Schema(description = "Linked customer id")
    private String customerId;

    @Schema(description = "Linked customer name (denormalized)")
    private String customerName;

    @Schema(description = "Reporter user ID")
    private String reporterId;

    @Schema(description = "Reporter display name")
    private String reporterName;

    @Schema(description = "Assignee user ID")
    private String assignedTo;

    @Schema(description = "Assignee display name (denormalized)")
    private String assignedName;

    @Schema(description = "True when the end user explicitly asked for a human technician")
    private Boolean escalatedByUser;

    @Schema(description = "True once the AI assistant no longer handles the ticket")
    private Boolean aiDisabled;

    @Schema(description = "Tags assigned to the ticket")
    private List<TicketTagResponse> tags;

    @Schema(description = "File attachments (metadata only)")
    private List<TicketAttachmentResponse> attachments;

    @Schema(description = "Internal notes")
    private List<TicketNoteResponse> notes;

    @Schema(description = "Manual board ordering rank within the status column")
    private String order;

    @Schema(description = "Creation timestamp")
    private Instant createdAt;

    @Schema(description = "Last update timestamp")
    private Instant updatedAt;

    @Schema(description = "Resolution timestamp (null while open)")
    private Instant resolvedAt;

    @Schema(description = "Who resolved the ticket (null while open)")
    private TicketResolver resolvedBy;

    @Schema(description = "Display name of the resolving technician")
    private String resolvedByName;

    @Schema(description = "How many times the ticket was reopened")
    private Integer reopenCount;
}
