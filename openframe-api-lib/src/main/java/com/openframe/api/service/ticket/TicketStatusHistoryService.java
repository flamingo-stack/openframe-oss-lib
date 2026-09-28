package com.openframe.api.service.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.repository.ticket.TicketStatusHistoryRepository;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Writes one history row per status transition: who moved the ticket, from which status to which,
 * when, and the reason they gave. The ticket itself only knows its current status — this history
 * is what future features read the path from. A failure to write history never breaks the
 * transition itself.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TicketStatusHistoryService {

    private final TicketStatusHistoryRepository historyRepository;
    private final TicketStatusHistoryMapper historyMapper;

    public void record(Ticket ticket, TicketStatusDefinition from, TicketStatusDefinition to,
                       AuthPrincipal principal, String reason) {
        try {
            historyRepository.save(historyMapper.toHistory(ticket, from, to, principal, reason));
            log.debug("Status transition recorded - ticketId: {}, {} → {}",
                    ticket.getId(), from.getName(), to.getName());
        } catch (Exception e) {
            log.error("Status transition record failed — swallowed, transition unaffected - ticketId: {}",
                    ticket.getId(), e);
        }
    }
}
