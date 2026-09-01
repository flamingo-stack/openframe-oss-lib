package com.openframe.external.dto.ticket;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Ticket note content")
public record TicketNoteRequest(
        @NotBlank(message = "Content is required")
        @Size(max = 5000)
        @Schema(description = "Note content", requiredMode = Schema.RequiredMode.REQUIRED)
        String content
) {
}
