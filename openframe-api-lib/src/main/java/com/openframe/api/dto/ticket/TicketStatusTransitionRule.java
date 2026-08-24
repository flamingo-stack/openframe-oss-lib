package com.openframe.api.dto.ticket;

import com.openframe.data.document.ticket.TicketStatusDefinition;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketStatusTransitionRule {
    private TicketStatusDefinition from;
    private List<TicketStatusDefinition> to;
}
