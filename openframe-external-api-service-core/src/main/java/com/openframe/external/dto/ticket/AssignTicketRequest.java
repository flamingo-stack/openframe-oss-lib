package com.openframe.external.dto.ticket;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Assign ticket request")
public class AssignTicketRequest {
    @NotBlank(message = "assigneeId is required")
    @Schema(description = "User ID of the assignee", requiredMode = Schema.RequiredMode.REQUIRED)
    private String assigneeId;
}
