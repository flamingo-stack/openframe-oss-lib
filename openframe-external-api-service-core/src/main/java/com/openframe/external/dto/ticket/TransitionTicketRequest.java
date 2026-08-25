package com.openframe.external.dto.ticket;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Move a ticket to another lifecycle status")
public record TransitionTicketRequest(
        @NotBlank(message = "toStatusId is required")
        @Schema(description = "Target status id (see the ticket's availableTransitions or GET /api/v1/tickets/statuses)",
                requiredMode = Schema.RequiredMode.REQUIRED)
        String toStatusId,

        @Size(max = 500)
        @Schema(description = "Optional reason recorded with the transition")
        String reason
) {
}
