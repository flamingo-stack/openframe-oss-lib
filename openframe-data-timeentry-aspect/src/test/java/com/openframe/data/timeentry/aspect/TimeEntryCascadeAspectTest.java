package com.openframe.data.timeentry.aspect;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.publishing.config.PublishedAggregateTopics;
import org.aspectj.lang.ProceedingJoinPoint;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class TimeEntryCascadeAspectTest {

    private final TimeEntryCascadeService timeEntryCascadeService = mock(TimeEntryCascadeService.class);
    private final TicketRepository ticketRepository = mock(TicketRepository.class);
    private final ProceedingJoinPoint joinPoint = mock(ProceedingJoinPoint.class);
    private final PublishedAggregateTopics publishedTopics = mock(PublishedAggregateTopics.class);
    private final TimeEntryCascadeAspect aspect =
            new TimeEntryCascadeAspect(timeEntryCascadeService, ticketRepository, publishedTopics);

    @Test
    void aTitleChange_cascadesToTheTimeEntries() throws Throwable {
        // setup
        Ticket renamed = buildTicket("New title");
        when(ticketRepository.findById("ticket-1")).thenReturn(Optional.of(buildTicket("Old title")));
        when(joinPoint.proceed()).thenReturn(renamed);

        // execution
        aspect.aroundTicketSave(joinPoint, renamed);

        // verifications
        verify(timeEntryCascadeService).updateTimeEntriesForTicketTitleChange("ticket-1", "New title");
    }

    @Test
    void publishedTickets_areOnlySaved_theStreamCopiesTheTitle() throws Throwable {
        // setup
        Ticket renamed = buildTicket("New title");
        when(publishedTopics.isPublishing("tickets")).thenReturn(true);
        when(joinPoint.proceed()).thenReturn(renamed);

        // execution
        aspect.aroundTicketSave(joinPoint, renamed);

        // verifications
        verify(joinPoint).proceed();
        verifyNoInteractions(ticketRepository, timeEntryCascadeService);
    }

    @Test
    void publishedTickets_savedTogether_areOnlySaved() throws Throwable {
        // setup
        List<Ticket> renamed = List.of(buildTicket("New title"));
        when(publishedTopics.isPublishing("tickets")).thenReturn(true);
        when(joinPoint.proceed()).thenReturn(renamed);

        // execution
        aspect.aroundTicketSaveAll(joinPoint, renamed);

        // verifications
        verify(joinPoint).proceed();
        verifyNoInteractions(ticketRepository, timeEntryCascadeService);
    }

    private static Ticket buildTicket(String title) {
        Ticket ticket = new Ticket();
        ticket.setId("ticket-1");
        ticket.setTitle(title);
        return ticket;
    }
}
