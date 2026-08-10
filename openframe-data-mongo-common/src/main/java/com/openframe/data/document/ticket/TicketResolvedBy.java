package com.openframe.data.document.ticket;

/**
 * Who resolved the ticket. A technician carries a user id; the AI assistant is not a user and
 * carries none.
 */
public enum TicketResolvedBy {
    TECHNICIAN,
    AI_AGENT
}
