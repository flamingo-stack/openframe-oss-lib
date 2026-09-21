package com.openframe.api.dto.ticket;

import com.openframe.data.document.ticket.TicketStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketStatusCount {
    private TicketStatus status;
    private Integer count;
}
