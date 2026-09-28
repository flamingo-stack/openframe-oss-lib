package com.openframe.external.dto.ticket;

import com.openframe.data.document.ticket.TicketOwnerType;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Ticket owner")
public record TicketOwnerResponse(
        @Schema(description = "Owner type") TicketOwnerType type,
        @Schema(description = "Owning device machineId (CLIENT owners only)") String machineId,
        @Schema(description = "Owning user ID (ADMIN owners only)") String userId
) {
}
