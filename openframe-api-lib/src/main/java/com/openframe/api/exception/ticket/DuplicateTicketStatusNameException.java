package com.openframe.api.exception.ticket;

import com.openframe.core.exception.ErrorCode;
import org.springframework.http.HttpStatus;

import java.util.Map;

public class DuplicateTicketStatusNameException extends TicketDomainException {
    public DuplicateTicketStatusNameException(String name) {
        super(ErrorCode.TICKET_STATUS_DUPLICATE_NAME, HttpStatus.CONFLICT,
                "Ticket status name already exists: " + name, Map.of("name", name));
    }
}
