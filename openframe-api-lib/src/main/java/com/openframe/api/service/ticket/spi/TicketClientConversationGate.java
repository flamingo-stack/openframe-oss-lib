package com.openframe.api.service.ticket.spi;

import java.util.Optional;

/**
 * Tells the transition policy what the conversational layer knows about a ticket: whether it has an
 * end-user (client chat) conversation to come back to, and which approval request, if any, is still
 * pending on it. The conversation store belongs to that layer, so deployments provide the lookups;
 * without a gate no ticket has a conversation (reopen-to-assistant stays off) and none is locked.
 */
public interface TicketClientConversationGate {

    boolean hasClientConversation(String ticketId);

    Optional<String> findPendingApprovalRequestId(String ticketId);
}
