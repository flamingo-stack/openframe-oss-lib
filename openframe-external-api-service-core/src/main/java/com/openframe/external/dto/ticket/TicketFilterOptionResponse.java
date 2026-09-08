package com.openframe.external.dto.ticket;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Ticket filter option")
public record TicketFilterOptionResponse(
        @Schema(description = "Value to pass back as a filter parameter") String value,
        @Schema(description = "Display label") String label
) {
}
