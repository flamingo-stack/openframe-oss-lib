package com.openframe.data.document.ticket.filter;

import lombok.Builder;

import java.time.Instant;
import java.util.List;
import java.util.Map;

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
