package com.openframe.external.dto.ticket;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Schema(description = "Create ticket request")
public class CreateTicketRequest {
        @NotBlank(message = "Title is required")
        @Size(max = 255)
        @Schema(description = "Ticket title", requiredMode = Schema.RequiredMode.REQUIRED)
        private String title;

        @Size(max = 5000)
        @Schema(description = "Ticket description")
        private String description;

        @Schema(description = "Initial status id: any custom status, or the TECH_REQUIRED system status. " +
                "Defaults to the first custom status. See GET /api/v1/tickets/statuses.")
        private String statusId;

        @Schema(description = "machineId of the device to link")
        private String deviceId;

        @Schema(description = "Customer id to link. Derived from the device when omitted; must match the device's customer when both are given.")
        private String customerId;

        @Schema(description = "User ID to assign the ticket to")
        private String assigneeId;

        @Size(max = 20)
        @Schema(description = "Tag ids to assign (see GET /api/v1/tickets/tags)")
        private List<String> tagIds;
}
