package com.openframe.test.data.dto.ticket;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Payload for {@code takeOverTicket}: one transition plus one assignment in a single operation. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TakeOverTicketInput {
    private String ticketId;
    private String toStatusId;
    private String assigneeId;
}
