package com.openframe.api.service.ticket;

import com.openframe.data.repository.ticket.TicketRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * Stamps the ticket's activity clock and its awaiting-client flag.
 * <p>
 * Every write here is a targeted update, never a save of the whole ticket: the document carries
 * {@code @LastModifiedDate updatedAt} and clients read that field as "the status moved", so
 * stamping activity through a save would quietly redefine an existing contract.
 * <p>
 * Failures are logged and swallowed — activity tracking is a board indicator and must never break
 * the message or transition flow that triggered it.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TicketActivityService {

    private final TicketRepository ticketRepository;

    /** Activity that does not change who we are waiting on: status moves, AI runs, system cards. */
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

    /**
     * Our side (AI agent or technician) spoke: the ticket is now waiting on the client.
     * Idempotent in effect — re-sending only moves the timestamps forward.
     */
    public void recordOutboundMessage(String ticketId) {
        stamp(ticketId, Instant.now(), true);
    }

    /** The client answered: activity moves forward and the wait is cleared. */
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
