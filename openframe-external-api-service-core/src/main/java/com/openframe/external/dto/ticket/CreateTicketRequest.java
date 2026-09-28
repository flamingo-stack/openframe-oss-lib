package com.openframe.external.dto.ticket;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

@Schema(description = "Create ticket request")
public record CreateTicketRequest(
        @NotBlank(message = "Title is required")
        @Size(max = 255)
        @Schema(description = "Ticket title", requiredMode = Schema.RequiredMode.REQUIRED)
        String title,

        @Size(max = 5000)
        @Schema(description = "Ticket description")
        String description,

        @Schema(description = "Initial status id: any custom status, or the TECH_REQUIRED system status. " +
                "Defaults to the first custom status. See GET /api/v1/tickets/statuses.")
        String statusId,

        @Schema(description = "machineId of the device to link")
        String deviceId,

        @Schema(description = "Customer id to link. Derived from the device when omitted; must match the device's customer when both are given.")
        String customerId,

        @Schema(description = "User ID to assign the ticket to")
        String assigneeId,

        @Size(max = 20)
        @Schema(description = "Tag ids to assign (see GET /api/v1/tickets/tags)")
        List<String> tagIds
) {
}
