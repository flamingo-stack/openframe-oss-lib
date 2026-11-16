package com.openframe.api.service.ticket.spi;

import java.util.List;

// Approval requests belong to the conversational layer, so deployments provide the lookup; without one no ticket
// waits on an approval.
public interface TicketPendingApprovalProvider {

    List<String> ticketIdsWithPendingApproval();
}
