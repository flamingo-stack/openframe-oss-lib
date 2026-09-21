package com.openframe.external.dto.ticket;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@AllArgsConstructor
@NoArgsConstructor
@Schema(description = "Ticket note content")
public class TicketNoteRequest {

        @NotBlank(message = "Content is required")
        @Size(max = 5000)
        @Schema(description = "Note content", requiredMode = Schema.RequiredMode.REQUIRED)
        private String content;
}

