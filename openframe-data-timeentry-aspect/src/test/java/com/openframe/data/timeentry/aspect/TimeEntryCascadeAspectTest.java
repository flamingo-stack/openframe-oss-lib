package com.openframe.data.timeentry.aspect;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.repository.ticket.TicketRepository;
import org.aspectj.lang.ProceedingJoinPoint;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class TimeEntryCascadeAspectTest {

    private final TimeEntryCascadeService timeEntryCascadeService = mock(TimeEntryCascadeService.class);
    private final TicketRepository ticketRepository = mock(TicketRepository.class);
    private final ProceedingJoinPoint joinPoint = mock(ProceedingJoinPoint.class);

    @Test
    void aTitleChange_cascadesToTheTimeEntries_whileTheTicketCascadeIsOn() throws Throwable {
        // setup
        TimeEntryCascadeAspect aspect = new TimeEntryCascadeAspect(timeEntryCascadeService, ticketRepository, true);
        Ticket renamed = buildTicket("New title");
        when(ticketRepository.findById("ticket-1")).thenReturn(Optional.of(buildTicket("Old title")));
        when(joinPoint.proceed()).thenReturn(renamed);

        // execution
        aspect.aroundTicketSave(joinPoint, renamed);

        // verifications
        verify(timeEntryCascadeService).updateTimeEntriesForTicketTitleChange("ticket-1", "New title");
    }

    @Test
    void aTitleChange_onlySaves_onceTheTicketCascadeIsOff() throws Throwable {
        // setup
        TimeEntryCascadeAspect aspect = new TimeEntryCascadeAspect(timeEntryCascadeService, ticketRepository, false);
        Ticket renamed = buildTicket("New title");
        List<Ticket> renamedAll = List.of(renamed);
        when(joinPoint.proceed()).thenReturn(renamed, renamedAll);

        // execution
        Object saved = aspect.aroundTicketSave(joinPoint, renamed);
        Object savedAll = aspect.aroundTicketSaveAll(joinPoint, renamedAll);

        // verifications
        assertThat(saved).isSameAs(renamed);
        assertThat(savedAll).isSameAs(renamedAll);
        verifyNoInteractions(ticketRepository, timeEntryCascadeService);
    }

    private static Ticket buildTicket(String title) {
        Ticket ticket = new Ticket();
        ticket.setId("ticket-1");
        ticket.setTitle(title);
        return ticket;
    }
}
