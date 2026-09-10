package com.openframe.external.dto.ticket;

import com.openframe.data.document.ticket.TicketStatusKind;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Ticket lifecycle status definition")
public class TicketStatusResponse {

    @Schema(description = "Status ID (use with statusId / toStatusId)")
    private String id;

    @Schema(description = "Display name", example = "In Progress")
    private String name;

    @Schema(description = "Display color (hex)", example = "#3B82F6")
    private String color;

    @Schema(description = "Board ordering rank")
    private String position;

    @Schema(description = "Status kind; CUSTOM for tenant-defined statuses")
    private TicketStatusKind kind;

    @Schema(description = "True for the built-in system statuses")
    private Boolean isSystem;

    @Schema(description = "System key (AI_ASSISTANCE, TECH_REQUIRED, RESOLVED, ARCHIVED) for system statuses, null for custom ones")
    private String systemKey;

    private Instant createdAt;

    private Instant updatedAt;
}
