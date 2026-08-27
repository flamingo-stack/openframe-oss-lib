package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.TicketFilterInput;
import com.openframe.security.authentication.AuthPrincipal;

import java.util.List;

public interface TicketIdRestriction {

    boolean isApplicable(TicketFilterInput filter);

    List<String> ticketIds(AuthPrincipal principal, TicketFilterInput filter);
}
