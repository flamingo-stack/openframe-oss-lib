package com.openframe.external.dto.ticket;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Move a ticket to another lifecycle status")
public class TransitionTicketRequest {
        @NotBlank(message = "toStatusId is required")
        @Schema(description = "Target status id (see the ticket's availableTransitions or GET /api/v1/tickets/statuses)",
                requiredMode = Schema.RequiredMode.REQUIRED)
        private String toStatusId;

        @Size(max = 500)
        @Schema(description = "Optional reason recorded with the transition")
        private String reason;
}
