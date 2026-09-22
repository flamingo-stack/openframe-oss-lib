package com.openframe.api.exception.ticket;

import com.openframe.core.exception.ErrorCode;
import org.springframework.http.HttpStatus;

import java.util.Map;

public class InvalidTicketStatusReorderException extends TicketDomainException {
    public InvalidTicketStatusReorderException(String reason) {
        super(ErrorCode.TICKET_STATUS_INVALID_REORDER, HttpStatus.BAD_REQUEST, reason, Map.of("reason", reason));
    }
}
