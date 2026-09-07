package com.openframe.api.service.ticket;

import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.filter.TicketActivityCriteria;
import com.openframe.data.document.ticket.filter.TicketActivityFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.springframework.util.CollectionUtils.isEmpty;

@Component
@RequiredArgsConstructor
public class TicketStalenessResolver {

    private final TicketStatusService ticketStatusService;
    private final TicketStalenessProperties properties;

    public int effectiveStaleAfterMinutes(TicketStatusDefinition definition) {
        if (definition == null || definition.getStaleAfterMinutes() == null) {
            return properties.getDefaultMinutes();
        }
        return definition.getStaleAfterMinutes();
    }

    public TicketActivityCriteria resolve(List<TicketActivityFilter> filters) {
        if (isEmpty(filters)) {
            return null;
        }
        Instant now = Instant.now();
        Map<String, Instant> cutoffs = new HashMap<>();
        if (needsThresholds(filters)) {
            for (TicketStatusDefinition definition : ticketStatusService.list()) {
                int minutes = effectiveStaleAfterMinutes(definition);
                cutoffs.put(definition.getId(), now.minus(minutes, ChronoUnit.MINUTES));
            }
        }
        return TicketActivityCriteria.builder()
                .filters(List.copyOf(filters))
                .staleCutoffByStatusId(cutoffs)
                .defaultStaleCutoff(now.minus(properties.getDefaultMinutes(), ChronoUnit.MINUTES))
                .build();
    }

    private boolean needsThresholds(List<TicketActivityFilter> filters) {
        return filters.contains(TicketActivityFilter.STALE) || filters.contains(TicketActivityFilter.ACTIVE);
    }
}
