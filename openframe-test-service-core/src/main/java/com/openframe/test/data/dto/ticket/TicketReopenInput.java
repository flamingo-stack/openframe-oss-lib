package com.openframe.test.data.dto.ticket;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload for {@code requestTicketReopen}, the client-initiated reopen of a RESOLVED or ARCHIVED
 * ticket. Only an AGENT caller may send it, for a ticket its machine owns; {@code handoffToTechnician}
 * forces Tech Required as the destination.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TicketReopenInput {
    private String id;
    private String reason;
    private Boolean handoffToTechnician;
}
