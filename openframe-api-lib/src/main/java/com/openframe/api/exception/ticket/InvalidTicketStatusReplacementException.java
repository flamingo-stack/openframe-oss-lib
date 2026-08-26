package com.openframe.api.exception.ticket;

import com.openframe.core.exception.ErrorCode;
import org.springframework.http.HttpStatus;

import java.util.Map;

public class InvalidTicketStatusReplacementException extends TicketDomainException {

    private InvalidTicketStatusReplacementException(String message, String statusId, String replacementStatusId) {
        super(ErrorCode.TICKET_STATUS_INVALID_REPLACEMENT,
                HttpStatus.BAD_REQUEST,
                message,
                Map.of("statusId", statusId, "replacementStatusId", replacementStatusId));
    }

    public static InvalidTicketStatusReplacementException sameStatus(String statusId, String replacementStatusId) {
        return new InvalidTicketStatusReplacementException(
                "Replacement status cannot equal the deleted status", statusId, replacementStatusId);
    }

    public static InvalidTicketStatusReplacementException notAllowedTarget(String statusId, String replacementStatusId) {
        return new InvalidTicketStatusReplacementException(
                "Replacement status must be a valid transition target from a custom status",
                statusId, replacementStatusId);
    }
}
