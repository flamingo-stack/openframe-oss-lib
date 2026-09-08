package com.openframe.api.exception.ticket;

import com.openframe.core.exception.ErrorCode;
import org.springframework.http.HttpStatus;

import java.util.Map;

public class AiDisabledForTicketException extends TicketDomainException {
    public AiDisabledForTicketException(String ticketId) {
        super(ErrorCode.TICKET_AI_DISABLED,
                HttpStatus.CONFLICT,
                "AI is permanently disabled for ticket: " + ticketId,
                Map.of("ticketId", ticketId));
    }
}
