package com.openframe.data.document.ticket;

/**
 * Who moved the ticket, as stored on {@link TicketStatusHistory} rows. Mirrors the auth-side
 * actor types so document modules stay independent of the security module — same pattern as
 * {@link TicketResolver} on the ticket itself.
 */
public enum TicketActorType {
    /** An admin acting from the dashboard: dropdown, board drag, take over. */
    ADMIN,
    /** The agent machine principal: Fae closing a ticket, and client-driven moves such as reopen,
     *  which arrive on the machine's token. */
    AGENT
}
