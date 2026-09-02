package com.openframe.data.document.ticket;

/**
 * The ticket's live activity, as shown on the board card. States are mutually exclusive and
 * resolved in declaration order — the first one that matches wins.
 * <p>
 * Staleness is deliberately absent: it is a function of {@code lastActivityAt} and the status
 * definition's stale threshold, both of which clients already hold, so the threshold can change
 * without a schema change. A card shows staleness only while the state is {@link #IDLE}.
 */
public enum TicketActivityState {

    /** The AI agent holds the dialog processing guard — a run is in flight. */
    AI_WORKING,

    /** The end user is typing right now. Backed by a short-TTL signal that expires on its own. */
    USER_TYPING,

    /** Our side spoke last and the client has not answered yet. Derived, never toggled by hand. */
    AWAITING_EXTERNAL,

    /** None of the above. */
    IDLE
}
