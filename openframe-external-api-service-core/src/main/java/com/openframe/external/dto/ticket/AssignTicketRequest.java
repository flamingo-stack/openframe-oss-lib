package com.openframe.external.dto.ticket;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Assign ticket request")
public record AssignTicketRequest(
        @NotBlank(message = "assigneeId is required")
        @Schema(description = "User ID of the assignee", requiredMode = Schema.RequiredMode.REQUIRED)
        String assigneeId
) {
}
