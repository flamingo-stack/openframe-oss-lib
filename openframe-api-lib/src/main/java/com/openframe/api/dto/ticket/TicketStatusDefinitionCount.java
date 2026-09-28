package com.openframe.api.dto.ticket;

import com.openframe.data.document.ticket.TicketStatusDefinition;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketStatusDefinitionCount {
    private TicketStatusDefinition status;
    private Integer count;
}
