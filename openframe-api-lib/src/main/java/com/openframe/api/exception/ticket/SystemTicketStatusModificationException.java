package com.openframe.api.exception.ticket;

import com.openframe.core.exception.ErrorCode;
import org.springframework.http.HttpStatus;

import java.util.Map;

public class SystemTicketStatusModificationException extends TicketDomainException {
    public SystemTicketStatusModificationException(String statusId, TicketStatusOperation attemptedOperation) {
        super(ErrorCode.TICKET_STATUS_SYSTEM_PROTECTED,
                HttpStatus.FORBIDDEN,
                "System ticket status cannot be modified: " + attemptedOperation.name(),
                Map.of("statusId", statusId, "attemptedOperation", attemptedOperation.name()));
    }
}
