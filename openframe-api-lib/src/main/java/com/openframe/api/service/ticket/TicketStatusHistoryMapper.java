package com.openframe.api.service.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketActorType;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusHistory;
import com.openframe.security.authentication.AuthPrincipal;
import org.springframework.stereotype.Component;

/**
 * Builds a {@link TicketStatusHistory} row from the transition parts. Kinds land as plain
 * {@code name()} strings and both status names as snapshots — history must survive vocabulary
 * changes. The auth actor type maps onto the document-local enum by constant name. Audit fields
 * (id, tenantId, createdAt) are left for Mongo to fill.
 */
@Component
public class TicketStatusHistoryMapper {

    public TicketStatusHistory toHistory(Ticket ticket, TicketStatusDefinition from, TicketStatusDefinition to,
                                         AuthPrincipal principal, String reason) {
        return TicketStatusHistory.builder()
                .ticketId(ticket.getId())
                .fromStatusId(from.getId())
                .fromStatusKind(from.getKind() != null ? from.getKind().name() : null)
                .fromStatusName(from.getName())
                .toStatusId(to.getId())
                .toStatusKind(to.getKind() != null ? to.getKind().name() : null)
                .toStatusName(to.getName())
                .actorId(principal.getId())
                .actorType(principal.getActorType() != null
                        ? TicketActorType.valueOf(principal.getActorType().name())
                        : null)
                .reason(reason)
                .build();
    }
}
