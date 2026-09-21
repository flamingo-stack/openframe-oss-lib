package com.openframe.api.service.ticket.spi;

import com.openframe.api.dto.ticket.CreateTicketInput;
import com.openframe.api.dto.ticket.UpdateTicketInput;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatus;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.security.authentication.AuthPrincipal;

import java.util.List;

/**
 * Extension point for side effects of ticket domain operations that live outside the core
 * (chat/dialog sync, notifications, AI handoff, attachment linking). The core services call every
 * registered listener inside the operation's transaction, in bean order. Deployments without such
 * integrations simply register none.
 */
public interface TicketEventListener {

    /** A ticket was created (manually, from a client form/dialog or by escalation) and saved. */
    default void onTicketCreated(Ticket ticket, CreateTicketInput input, AuthPrincipal principal) {
    }

    /** Title/description/links/assignee/tags were updated and saved. */
    default void onTicketUpdated(Ticket ticket, UpdateTicketInput input, AuthPrincipal principal) {
    }

    /** The ticket was (re)assigned to a user and saved. */
    default void onTicketAssigned(Ticket ticket, AuthPrincipal principal) {
    }

    /** Legacy (lifecycle-off) status change was saved. */
    default void onLegacyStatusChanged(Ticket ticket, TicketStatus previousStatus, AuthPrincipal principal) {
    }

    /** Bulk archive of resolved tickets completed. */
    default void onTicketsArchived(List<String> ticketIds, AuthPrincipal principal) {
    }

    /**
     * Lifecycle transition was saved. {@code reopening} is true when the ticket left a closed stage
     * (RESOLVED/ARCHIVED) for an open one; {@code reopenReason} is the client's free text, if any.
     */
    default void onTicketTransitioned(Ticket ticket,
                                      TicketStatusDefinition from,
                                      TicketStatusDefinition to,
                                      AuthPrincipal principal,
                                      boolean reopening,
                                      String reopenReason) {
    }
}
