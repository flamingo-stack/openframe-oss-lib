package com.openframe.api.service.ticket;

import com.github.pravin.raha.lexorank4j.LexoRank;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatus;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Optional;

/** LexoRank ordering within the legacy (lifecycle-off) status columns. */
@Component
@RequiredArgsConstructor
public class TicketOrderCalculationService {

    private final TicketRepository ticketRepository;
    private final TenantIdProvider tenantIdProvider;

    public String computeRankBetween(String afterTicketId, String beforeTicketId, TicketStatus targetStatus) {
        if (areBothNeighborsAbsent(afterTicketId, beforeTicketId)) {
            throw new IllegalArgumentException("afterTicketId or beforeTicketId must be specified");
        }
        if (areBothNeighborsPresent(afterTicketId, beforeTicketId)) {
            LexoRank lower = loadRank(afterTicketId, targetStatus);
            LexoRank upper = loadRank(beforeTicketId, targetStatus);
            return lower.between(upper).format();
        }
        if (afterTicketId != null) {
            LexoRank anchor = loadRank(afterTicketId, targetStatus);
            return rankAfterAnchor(anchor, targetStatus);
        }
        LexoRank anchor = loadRank(beforeTicketId, targetStatus);
        return rankBeforeAnchor(anchor, targetStatus);
    }

    public String computeRankAtTop(TicketStatus status) {
        return findFirstRankInColumn(status)
                .map(LexoRank::genPrev)
                .orElseGet(LexoRank::middle)
                .format();
    }

    private String rankAfterAnchor(LexoRank anchor, TicketStatus status) {
        return findRankAfter(status, anchor)
                .map(anchor::between)
                .orElseGet(anchor::genNext)
                .format();
    }

    private String rankBeforeAnchor(LexoRank anchor, TicketStatus status) {
        return findRankBefore(status, anchor)
                .map(anchor::between)
                .orElseGet(anchor::genPrev)
                .format();
    }

    private boolean areBothNeighborsAbsent(String afterTicketId, String beforeTicketId) {
        return afterTicketId == null && beforeTicketId == null;
    }

    private boolean areBothNeighborsPresent(String afterTicketId, String beforeTicketId) {
        return afterTicketId != null && beforeTicketId != null;
    }

    private Optional<LexoRank> findFirstRankInColumn(TicketStatus status) {
        return ticketRepository.findFirstInColumn(status, tenantIdProvider.getTenantId()).map(this::parseOrder);
    }

    private Optional<LexoRank> findRankAfter(TicketStatus status, LexoRank anchor) {
        return ticketRepository.findFirstAfter(status, anchor.format(), tenantIdProvider.getTenantId()).map(this::parseOrder);
    }

    private Optional<LexoRank> findRankBefore(TicketStatus status, LexoRank anchor) {
        return ticketRepository.findFirstBefore(status, anchor.format(), tenantIdProvider.getTenantId()).map(this::parseOrder);
    }

    private LexoRank loadRank(String ticketId, TicketStatus expectedStatus) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Neighbor ticket not found: " + ticketId));
        if (ticket.getStatus() != expectedStatus) {
            throw new IllegalArgumentException(
                    "Neighbor " + ticketId + " is in status " + ticket.getStatus()
                            + ", expected " + expectedStatus);
        }
        return parseOrder(ticket);
    }

    private LexoRank parseOrder(Ticket ticket) {
        String order = ticket.getOrder();
        if (order == null) {
            throw new IllegalStateException("Ticket " + ticket.getId() + " has no order");
        }
        return LexoRank.parse(order);
    }
}
