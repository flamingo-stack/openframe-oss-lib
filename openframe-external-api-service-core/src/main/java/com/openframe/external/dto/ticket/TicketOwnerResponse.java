package com.openframe.external.dto.ticket;

import com.openframe.data.document.ticket.TicketOwnerType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Ticket owner")
public class TicketOwnerResponse {

    @Schema(description = "Owner type")
    private TicketOwnerType type;

    @Schema(description = "Owning device machineId (CLIENT owners only)")
    private String machineId;

    @Schema(description = "Owning user ID (ADMIN owners only)")
    private String userId;
}
