package com.openframe.api.service.ticket;

import java.util.List;

/**
 * Explicit result of resolving ticket id restrictions.
 * <p>
 * Three states are distinguished without resorting to null:
 * <ul>
 *     <li>unrestricted — no filter applied; {@link #restricted()} is {@code false}</li>
 *     <li>restricted with ids — a filter applied and matched some tickets</li>
 *     <li>restricted empty — a filter applied and matched nothing</li>
 * </ul>
 */
public record TicketIdRestriction(boolean restricted, List<String> ticketIds) {

    private static final TicketIdRestriction UNRESTRICTED = new TicketIdRestriction(false, List.of());

    public static TicketIdRestriction unrestricted() {
        return UNRESTRICTED;
    }

    public static TicketIdRestriction of(List<String> ticketIds) {
        return new TicketIdRestriction(true, ticketIds);
    }
}
