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

    public boolean recordActivity(String ticketId) {
        if (ticketId == null) {
            return false;
        }
        try {
            return ticketRepository.updateLastActivityAt(ticketId, Instant.now()).isPresent();
        } catch (Exception e) {
            log.error("Failed to stamp activity for ticket {}", ticketId, e);
            return false;
        }
    }

    public boolean recordOutboundMessage(String ticketId) {
        return stamp(ticketId, Instant.now(), true);
    }

    public boolean recordClientMessage(String ticketId) {
        return stamp(ticketId, Instant.now(), false);
    }

    private boolean stamp(String ticketId, Instant now, boolean awaitingClient) {
        if (ticketId == null) {
            return false;
        }
        try {
            return ticketRepository.updateActivityAndAwaiting(ticketId, now, awaitingClient ? now : null).isPresent();
        } catch (Exception e) {
            log.error("Failed to stamp activity for ticket {} (awaiting={})", ticketId, awaitingClient, e);
            return false;
        }
    }
}
