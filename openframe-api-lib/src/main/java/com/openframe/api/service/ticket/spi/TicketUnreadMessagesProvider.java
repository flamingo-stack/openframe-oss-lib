package com.openframe.api.service.ticket.spi;

import com.openframe.security.authentication.AuthPrincipal;

import java.util.List;

// The conversation store belongs to the conversational layer, so deployments provide the lookup;
// without one the ticket filter falls back to unread notifications.
public interface TicketUnreadMessagesProvider {

    List<String> ticketIdsWithUnreadMessages(AuthPrincipal principal);
}
