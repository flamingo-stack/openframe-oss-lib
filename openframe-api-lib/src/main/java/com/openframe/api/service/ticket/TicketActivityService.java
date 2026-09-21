package com.openframe.api.service.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.repository.ticket.TicketRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class TicketActivityService {

    private final TicketRepository ticketRepository;

    public Optional<Ticket> recordActivity(String ticketId) {
        if (ticketId == null) {
            return Optional.empty();
        }
        try {
            return ticketRepository.updateLastActivityAt(ticketId, Instant.now());
        } catch (Exception e) {
            log.warn("Failed to stamp activity for ticket {}", ticketId, e);
            return Optional.empty();
        }
    }

    public Optional<Ticket> recordOutboundMessage(String ticketId) {
        return stamp(ticketId, Instant.now(), true);
    }

    public Optional<Ticket> recordClientMessage(String ticketId) {
        return stamp(ticketId, Instant.now(), false);
    }

    private Optional<Ticket> stamp(String ticketId, Instant now, boolean awaitingClient) {
        if (ticketId == null) {
            return Optional.empty();
        }
        try {
            return ticketRepository.updateActivityAndAwaiting(ticketId, now, awaitingClient ? now : null);
        } catch (Exception e) {
            log.warn("Failed to stamp activity for ticket {} (awaiting={})", ticketId, awaitingClient, e);
            return Optional.empty();
        }
    }
}
