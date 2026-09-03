package com.openframe.api.service;

import com.openframe.api.dto.timetracking.StartTimerCommand;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.document.timetracking.TimeEntry;
import com.openframe.data.repository.timetracking.TimeEntryRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Time tracking is refused on archived tickets. Which field says "archived" is exactly what the
 * lifecycle rollout changes, so the rule is pinned to {@code statusKind} here — a ticket carrying
 * no kind at all must not be treated as archived by some other field.
 */
@ExtendWith(MockitoExtension.class)
class TimeEntryServiceArchivedTicketTest {

    private static final String USER_ID = "user-1";
    private static final String TICKET_ID = "ticket-1";

    @Mock private TimeEntryRepository timeEntryRepository;
    @Mock private TicketQueryService ticketQueryService;

    @InjectMocks private TimeEntryService service;

    @Test
    void startTimer_onArchivedKindTicket_isRejected() {
        givenTicket(ticket(TicketStatusKind.ARCHIVED));

        assertThatThrownBy(() -> service.startTimer(USER_ID, startOn(TICKET_ID)))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("archived");

        verify(timeEntryRepository, never()).save(any());
    }

    @Test
    void startTimer_onResolvedKindTicket_isAllowed() {
        givenTicket(ticket(TicketStatusKind.RESOLVED));
        givenSaveEchoesEntry();

        TimeEntry started = service.startTimer(USER_ID, startOn(TICKET_ID));

        assertThat(started.getTicketId()).isEqualTo(TICKET_ID);
        verify(timeEntryRepository).save(any());
    }

    /**
     * No {@code statusKind} means the ticket predates the lifecycle backfill: nothing else may
     * stand in for it, so the timer starts.
     */
    @Test
    void startTimer_onTicketWithoutStatusKind_isAllowed() {
        givenTicket(ticket(null));
        givenSaveEchoesEntry();

        TimeEntry started = service.startTimer(USER_ID, startOn(TICKET_ID));

        assertThat(started.getTicketId()).isEqualTo(TICKET_ID);
        verify(timeEntryRepository).save(any());
    }

    @Test
    void startTimer_onUnknownTicket_isRejected() {
        when(ticketQueryService.findById(TICKET_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.startTimer(USER_ID, startOn(TICKET_ID)))
                .isInstanceOf(NotFoundException.class);

        verify(timeEntryRepository, never()).save(any());
    }

    @Test
    void startTimer_withoutTicket_doesNotConsultTickets() {
        givenSaveEchoesEntry();

        TimeEntry started = service.startTimer(USER_ID, StartTimerCommand.builder().notes("no ticket").build());

        assertThat(started.getTicketId()).isNull();
        verify(ticketQueryService, never()).findById(any());
    }

    private void givenTicket(Ticket ticket) {
        when(ticketQueryService.findById(TICKET_ID)).thenReturn(Optional.of(ticket));
    }

    private void givenSaveEchoesEntry() {
        when(timeEntryRepository.save(any())).thenAnswer(call -> call.getArgument(0));
    }

    private static Ticket ticket(TicketStatusKind kind) {
        return Ticket.builder()
                .id(TICKET_ID)
                .ticketNumber(42)
                .title("Printer is on fire")
                .statusId("st-1")
                .statusKind(kind)
                .build();
    }

    private static StartTimerCommand startOn(String ticketId) {
        return StartTimerCommand.builder().ticketId(ticketId).build();
    }
}
