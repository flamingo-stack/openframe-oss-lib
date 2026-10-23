package com.openframe.data.timeentry.aspect;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.repository.ticket.TicketRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

@Aspect
@Slf4j
@RequiredArgsConstructor
public class TimeEntryCascadeAspect {

    private final TimeEntryCascadeService timeEntryCascadeService;
    private final TicketRepository ticketRepository;

    @Around("execution(* com.openframe.data.repository.ticket.TicketRepository.save(..)) && args(ticket)")
    public Object aroundTicketSave(ProceedingJoinPoint joinPoint, Ticket ticket) throws Throwable {
        String oldTitle = captureTicketTitle(ticket);

        Ticket savedTicket = (Ticket) joinPoint.proceed();

        String newTitle = savedTicket.getTitle();
        if (oldTitle != null && !Objects.equals(oldTitle, newTitle)) {
            cascadeTicketTitleChange(savedTicket.getId(), newTitle);
        }

        return savedTicket;
    }

    @Around("execution(* com.openframe.data.repository.ticket.TicketRepository.saveAll(..)) && args(tickets)")
    public Object aroundTicketSaveAll(ProceedingJoinPoint joinPoint, Iterable<Ticket> tickets) throws Throwable {
        Map<String, String> oldTitles = captureTicketTitles(tickets);

        @SuppressWarnings("unchecked")
        Iterable<Ticket> result = (Iterable<Ticket>) joinPoint.proceed();

        for (Ticket saved : result) {
            String oldTitle = oldTitles.get(saved.getId());
            String newTitle = saved.getTitle();
            if (oldTitle != null && !Objects.equals(oldTitle, newTitle)) {
                cascadeTicketTitleChange(saved.getId(), newTitle);
            }
        }
        return result;
    }

    private String captureTicketTitle(Ticket ticket) {
        if (ticket.getId() == null) {
            return null;
        }
        return ticketRepository.findById(ticket.getId())
                .map(Ticket::getTitle)
                .orElse(null);
    }

    private Map<String, String> captureTicketTitles(Iterable<Ticket> tickets) {
        Map<String, String> titles = new HashMap<>();
        for (Ticket ticket : tickets) {
            if (ticket.getId() != null) {
                ticketRepository.findById(ticket.getId())
                        .ifPresent(existing -> titles.put(ticket.getId(), existing.getTitle()));
            }
        }
        return titles;
    }

    private void cascadeTicketTitleChange(String ticketId, String newTitle) {
        log.debug("Ticket title changed: ticketId={}, newTitle='{}'", ticketId, newTitle);
        try {
            timeEntryCascadeService.updateTimeEntriesForTicketTitleChange(ticketId, newTitle);
        } catch (Exception e) {
            log.error("Failed to cascade ticket title change to time entries: ticketId={}, error={}",
                    ticketId, e.getMessage(), e);
        }
    }
}
