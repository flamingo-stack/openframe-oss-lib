package com.openframe.data.document.ticket.filter;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Getter
@Builder
@AllArgsConstructor
public class TicketActivityCriteria {
    private final List<TicketActivityFilter> filters;
    private final Map<String, Instant> staleCutoffByStatusId;
    private final Instant defaultStaleCutoff;

    public boolean isEmpty() {
        return filters == null || filters.isEmpty();
    }

    public boolean has(TicketActivityFilter filter) {
        return filters != null && filters.contains(filter);
    }
}
