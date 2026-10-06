package com.openframe.api.service;

import com.openframe.api.dto.timetracking.StartTimerCommand;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * A started timer carries a snapshot of the ticket it is logged against — number, title and the
 * owning organization — so the entry still reads correctly after the ticket moves on. Without a
 * ticket the organization comes from the caller instead.
 */
@ExtendWith(MockitoExtension.class)
class TimeEntryServiceTicketSnapshotTest {

    private static final String USER_ID = "user-1";
    private static final String TICKET_ID = "ticket-1";

    @Mock private TimeEntryRepository timeEntryRepository;
    @Mock private TicketQueryService ticketQueryService;

    @InjectMocks private TimeEntryService service;

    @Test
    void startTimer_copiesTheTicketNumberTitleAndOrganization() {
        givenTicket(ticket("org-7"));
        givenSaveEchoesEntry();

        TimeEntry started = service.startTimer(USER_ID, StartTimerCommand.builder().ticketId(TICKET_ID).build());

        assertThat(started.getTicketNumber()).isEqualTo(42);
        assertThat(started.getTicketTitle()).isEqualTo("Printer is on fire");
        assertThat(started.getOrganizationId()).isEqualTo("org-7");
    }

    /** The ticket owns the organization: a manually supplied one must not override it. */
    @Test
    void startTimer_prefersTheTicketOrganizationOverTheSuppliedOne() {
        givenTicket(ticket("org-from-ticket"));
        givenSaveEchoesEntry();

        TimeEntry started = service.startTimer(USER_ID, StartTimerCommand.builder()
                .ticketId(TICKET_ID)
                .organizationId("org-from-caller")
                .build());

        assertThat(started.getOrganizationId()).isEqualTo("org-from-ticket");
    }

    @Test
    void startTimer_onATicketWithoutAnOrganization_leavesItUnset() {
        givenTicket(ticket(null));
        givenSaveEchoesEntry();

        TimeEntry started = service.startTimer(USER_ID, StartTimerCommand.builder()
                .ticketId(TICKET_ID)
                .organizationId("org-from-caller")
                .build());

        assertThat(started.getOrganizationId()).isNull();
    }

    @Test
    void startTimer_withoutATicket_takesTheSuppliedOrganization() {
        givenSaveEchoesEntry();

        TimeEntry started = service.startTimer(USER_ID, StartTimerCommand.builder()
                .organizationId("org-from-caller")
                .notes("investigating")
                .build());

        assertThat(started.getOrganizationId()).isEqualTo("org-from-caller");
        assertThat(started.getTicketNumber()).isNull();
        assertThat(started.getTicketTitle()).isNull();
        assertThat(started.getNotes()).isEqualTo("investigating");
    }

    @Test
    void startTimer_withABlankOrganization_leavesItUnset() {
        givenSaveEchoesEntry();

        TimeEntry started = service.startTimer(USER_ID, StartTimerCommand.builder()
                .organizationId("   ")
                .notes("investigating")
                .build());

        assertThat(started.getOrganizationId()).isNull();
    }

    @Test
    void startTimer_withoutACommand_startsABareEntry() {
        givenSaveEchoesEntry();

        TimeEntry started = service.startTimer(USER_ID, null);

        assertThat(started.getUserId()).isEqualTo(USER_ID);
        assertThat(started.getTicketId()).isNull();
        assertThat(started.getOrganizationId()).isNull();
        assertThat(started.getNotes()).isNull();
        assertThat(started.getStartedAt()).isNotNull();
    }

    private void givenTicket(Ticket ticket) {
        when(ticketQueryService.findById(TICKET_ID)).thenReturn(Optional.of(ticket));
    }

    private void givenSaveEchoesEntry() {
        when(timeEntryRepository.save(any())).thenAnswer(call -> call.getArgument(0));
    }

    private static Ticket ticket(String organizationId) {
        return Ticket.builder()
                .id(TICKET_ID)
                .ticketNumber(42)
                .title("Printer is on fire")
                .statusId("st-1")
                .statusKind(TicketStatusKind.TECH_REQUIRED)
                .organizationId(organizationId)
                .build();
    }
}
