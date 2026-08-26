package com.openframe.external.dto.ticket;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Ticket filter option")
public class TicketFilterOptionResponse {

    @Schema(description = "Value to pass back as a filter parameter")
    private String value;

    @Schema(description = "Display label")
    private String label;
}
