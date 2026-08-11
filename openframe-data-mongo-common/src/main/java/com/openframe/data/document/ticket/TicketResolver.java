package com.openframe.data.document.ticket;

/**
 * Who resolved the ticket.
 */
public enum TicketResolver {
    /** A support technician closed it from the board; carries their user id. */
    TECHNICIAN,
    /** The client asked to close the ticket, or agreed when the assistant offered. A client has no
     *  user record of their own, so no id and no name are stored. */
    END_USER,
    /** The platform closed it with nobody asking — reserved for the unattended auto-close job. */
    AI_AGENT
}
