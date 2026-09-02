package com.openframe.data.document.ticket.filter;

/**
 * Board filter over ticket activity. Multi-valued with OR semantics inside the parameter and AND
 * against every other filter.
 * <p>
 * These are time-based predicates on {@code lastActivityAt} and {@code awaitingClientSince} only —
 * never on the live Redis signals behind {@code TicketActivityState}. That keeps the filter a plain
 * Mongo criterion, which is what lets it compose with per-column cursor pagination.
 */
public enum TicketActivityFilter {

    /** Activity within the status' stale threshold. */
    ACTIVE,

    /** No activity for longer than the status' stale threshold. */
    STALE,

    /** Waiting on the client: our side sent the last message. */
    AWAITING_EXTERNAL
}
