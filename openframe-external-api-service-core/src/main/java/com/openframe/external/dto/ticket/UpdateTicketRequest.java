package com.openframe.external.dto.ticket;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Schema(description = "Update ticket request; only non-null fields are applied")
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class UpdateTicketRequest {
    @Size(max = 255)
    @Schema(description = "New title")
    private String title;

    @Size(max = 5000)
    @Schema(description = "New description")
    private String description;

    @Schema(description = "machineId of the device to link")
    private String deviceId;

    @Schema(description = "Customer id to link")
    private String customerId;

    @Schema(description = "User ID to assign the ticket to")
    private String assigneeId;

    @Size(max = 20)
    @Schema(description = "Full set of tag ids; replaces the current tags when present")
    private List<String> tagIds;
}

