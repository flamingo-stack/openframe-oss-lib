package com.openframe.data.repository.ticket.publishing;

import com.openframe.data.document.ticket.Ticket;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class TicketAggregateSpecTest {

    private final TicketOnTimeEntriesProjection ticketOnTimeEntries = mock(TicketOnTimeEntriesProjection.class);
    private final TicketAggregateSpec spec = new TicketAggregateSpec(ticketOnTimeEntries);

    @Test
    void theEvent_carriesTheIdAndTheTitleOnly() {
        Ticket ticket = new Ticket();
        ticket.setId("ticket-1");
        ticket.setTitle("Printer jam");
        ticket.setDescription("internal");

        TicketEvent event = spec.toEvent(ticket);

        assertThat(event.getTicketId()).isEqualTo("ticket-1");
        assertThat(event.getTitle()).isEqualTo("Printer jam");
    }

    @Test
    void theSpec_isTheTicketsType_withTheTimeEntryProjection() {
        assertThat(spec.getType()).isEqualTo("tickets");
        assertThat(spec.projections()).containsExactly(ticketOnTimeEntries);
    }
}
