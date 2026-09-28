package com.openframe.external.dto.ticket;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Internal ticket note")
public class TicketNoteResponse {

    @Schema(description = "Note ID")
    private String id;

    @Schema(description = "Ticket ID")
    private String ticketId;

    @Schema(description = "Note content")
    private String content;

    @Schema(description = "Author user ID")
    private String authorId;

    private Instant createdAt;

    private Instant updatedAt;
}
