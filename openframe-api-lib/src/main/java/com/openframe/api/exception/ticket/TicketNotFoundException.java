package com.openframe.api.exception.ticket;

import com.openframe.core.exception.ErrorCode;
import org.springframework.http.HttpStatus;

import java.util.Map;

public class TicketNotFoundException extends TicketDomainException {
    public TicketNotFoundException(String ticketId) {
        super(ErrorCode.TICKET_NOT_FOUND, HttpStatus.NOT_FOUND,
                "Ticket not found: " + ticketId, Map.of("ticketId", ticketId));
    }
}
