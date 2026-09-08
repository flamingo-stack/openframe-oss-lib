package com.openframe.api.service.ticket.spi;

/**
 * Tells the transition policy whether a ticket has an end-user (client chat) conversation to come
 * back to. The conversation store belongs to the conversational layer, so deployments provide the
 * lookup; without a gate no ticket is considered to have one, which keeps reopen-to-assistant off.
 */
public interface TicketClientConversationGate {

    boolean hasClientConversation(String ticketId);
}
