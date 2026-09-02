package com.openframe.data.document.ticket.filter;

import lombok.Builder;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Activity filter resolved down to plain values the repository can turn into Mongo criteria without
 * reaching for a service or a clock.
 * <p>
 * Stale thresholds vary per status, so the cutoff instants are pre-computed per status id by the
 * caller ({@code now - staleAfterMinutes}); {@code defaultStaleCutoff} covers tickets whose status
 * id is not in the map — legacy rows, or a status deleted mid-query.
 *
 * @param filters           requested values, OR'd together
 * @param staleCutoffByStatusId activity strictly before this instant is stale, per status id
 * @param defaultStaleCutoff cutoff for status ids absent from the map
 */
@Builder
public record TicketActivityCriteria(
        List<TicketActivityFilter> filters,
        Map<String, Instant> staleCutoffByStatusId,
        Instant defaultStaleCutoff) {

    public boolean isEmpty() {
        return filters == null || filters.isEmpty();
    }

    public boolean has(TicketActivityFilter filter) {
        return filters != null && filters.contains(filter);
    }
}
