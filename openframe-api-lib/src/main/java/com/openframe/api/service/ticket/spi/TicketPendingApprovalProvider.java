package com.openframe.api.service.ticket.spi;

import java.util.List;

public interface TicketPendingApprovalProvider {

    List<String> ticketIdsWithPendingApproval();
}
