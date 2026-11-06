package com.openframe.data.repository.ticket.publishing;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.api.spec.Projection;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

// TicketRepository publishes with this spec, and so does CustomTicketRepositoryImpl.updateTitle, which writes outside it.
@Component
@RequiredArgsConstructor
public class TicketAggregateSpec implements AggregateSpec<Ticket, TicketEvent> {

    public static final String TYPE = "tickets";

    private final TicketOnTimeEntriesProjection ticketOnTimeEntries;

    @Override
    public String getType() {
        return TYPE;
    }

    @Override
    public TicketEvent toEvent(Ticket ticket) {
        return TicketEvent.builder()
                .ticketId(ticket.getId())
                .title(ticket.getTitle())
                .build();
    }

    @Override
    public List<Projection<TicketEvent, ?>> projections() {
        return List.of(ticketOnTimeEntries);
    }
}
