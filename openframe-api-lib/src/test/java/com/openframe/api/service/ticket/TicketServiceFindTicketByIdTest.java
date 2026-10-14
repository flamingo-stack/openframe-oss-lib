package com.openframe.api.service.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.repository.ticket.TicketRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketServiceFindTicketByIdTest {

    private static final String TICKET_ID = "665f1c2ab3e4d5f6a7b8c9d0";

    @Mock private TicketRepository ticketRepository;

    @InjectMocks private TicketService service;

    private Ticket ticket;

    @BeforeEach
    void setUp() {
        ticket = Ticket.builder().id(TICKET_ID).build();
    }

    @Test
    void findTicketById_existingTicket_returned() {
        // setup
        when(ticketRepository.findById(TICKET_ID)).thenReturn(Optional.of(ticket));

        // execution
        Optional<Ticket> found = service.findTicketById(TICKET_ID);

        // verifications
        assertThat(found).containsSame(ticket);
    }

    @Test
    void findTicketById_missingTicket_empty() {
        // setup
        when(ticketRepository.findById(TICKET_ID)).thenReturn(Optional.empty());

        // execution
        Optional<Ticket> found = service.findTicketById(TICKET_ID);

        // verifications
        assertThat(found).isEmpty();
    }
}
