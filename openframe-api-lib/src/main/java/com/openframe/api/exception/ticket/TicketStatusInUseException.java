package com.openframe.api.exception.ticket;

import com.openframe.core.exception.ErrorCode;
import org.springframework.http.HttpStatus;

import java.util.Map;

public class TicketStatusInUseException extends TicketDomainException {
    public TicketStatusInUseException(String statusId, long affectedTicketCount) {
        super(ErrorCode.TICKET_STATUS_IN_USE,
                HttpStatus.CONFLICT,
                "Ticket status is in use by " + affectedTicketCount + " ticket(s): " + statusId,
                Map.of("statusId", statusId, "affectedTicketCount", affectedTicketCount));
    }
}
