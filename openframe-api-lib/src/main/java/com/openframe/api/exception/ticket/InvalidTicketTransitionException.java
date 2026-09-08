package com.openframe.api.exception.ticket;

import com.openframe.core.exception.ErrorCode;
import com.openframe.data.document.ticket.TicketStatusKind;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Map;

public class InvalidTicketTransitionException extends TicketDomainException {
    public InvalidTicketTransitionException(TicketStatusKind from,
                                            TicketStatusKind to,
                                            List<String> allowedStatusIds) {
        super(ErrorCode.TICKET_INVALID_TRANSITION,
                HttpStatus.CONFLICT,
                "Invalid ticket status transition: " + from + " → " + to,
                Map.of(
                        "fromKind", from.name(),
                        "toKind", to.name(),
                        "allowedStatusIds", List.copyOf(allowedStatusIds)
                ));
    }
}
