package com.openframe.api.exception.ticket;

import com.openframe.core.exception.ErrorCode;
import org.springframework.http.HttpStatus;

import java.util.Map;

public class TicketStatusNotFoundException extends TicketDomainException {
    public TicketStatusNotFoundException(String statusId) {
        super(ErrorCode.TICKET_STATUS_NOT_FOUND, HttpStatus.NOT_FOUND,
                "Ticket status not found: " + statusId, Map.of("statusId", statusId));
    }
}
