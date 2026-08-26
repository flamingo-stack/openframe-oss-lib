package com.openframe.external.dto.ticket;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

import java.util.List;

@Schema(description = "Update ticket request; only non-null fields are applied")
public record UpdateTicketRequest(
        @Size(max = 255)
        @Schema(description = "New title")
        String title,

        @Size(max = 5000)
        @Schema(description = "New description")
        String description,

        @Schema(description = "machineId of the device to link")
        String deviceId,

        @Schema(description = "organizationId to link")
        String organizationId,

        @Schema(description = "User ID to assign the ticket to")
        String assigneeId,

        @Size(max = 20)
        @Schema(description = "Full set of tag ids; replaces the current tags when present")
        List<String> tagIds
) {
}
