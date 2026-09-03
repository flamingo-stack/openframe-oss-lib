package com.openframe.api.service.ticket;

import com.openframe.data.repository.ticket.TicketRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
@RequiredArgsConstructor
@Slf4j
public class TicketActivityService {

    private final TicketRepository ticketRepository;

    public void recordActivity(String ticketId) {
        if (ticketId == null) {
            return;
        }
        try {
            ticketRepository.updateLastActivityAt(ticketId, Instant.now());
        } catch (Exception e) {
            log.warn("Failed to stamp activity for ticket {}", ticketId, e);
        }
    }

    public void recordOutboundMessage(String ticketId) {
        stamp(ticketId, Instant.now(), true);
    }

    public void recordClientMessage(String ticketId) {
        stamp(ticketId, Instant.now(), false);
    }

    private void stamp(String ticketId, Instant now, boolean awaitingClient) {
        if (ticketId == null) {
            return;
        }
        try {
            ticketRepository.updateActivityAndAwaiting(ticketId, now, awaitingClient ? now : null);
        } catch (Exception e) {
            log.warn("Failed to stamp activity for ticket {} (awaiting={})", ticketId, awaitingClient, e);
        }
    }
}
