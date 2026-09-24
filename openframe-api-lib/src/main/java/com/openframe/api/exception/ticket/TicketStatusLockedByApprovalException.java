package com.openframe.api.exception.ticket;

import com.openframe.core.exception.ErrorCode;
import org.springframework.http.HttpStatus;

import java.util.Map;

public class TicketStatusLockedByApprovalException extends TicketDomainException {
    public TicketStatusLockedByApprovalException(String ticketId, String approvalRequestId) {
        super(ErrorCode.TICKET_STATUS_LOCKED_BY_APPROVAL,
                HttpStatus.CONFLICT,
                "Ticket status is locked while approval request " + approvalRequestId
                        + " is pending. Approve or reject it before changing the status.",
                Map.of("ticketId", ticketId, "approvalRequestId", approvalRequestId));
    }
}
