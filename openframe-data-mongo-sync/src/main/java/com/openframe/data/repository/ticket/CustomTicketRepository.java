package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatus;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.document.ticket.filter.TicketQueryFilter;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface CustomTicketRepository {

    default Query buildTicketQuery(TicketQueryFilter filter) {
        return buildTicketQuery(filter, null, null, null);
    }

    Query buildTicketQuery(TicketQueryFilter filter, String search,
                           List<String> restrictToTicketIds, String ownerMachineId);

    List<Ticket> findTicketsWithCursor(Query query, String cursor, int limit,
                                        String sortField, String sortDirection);

    long countTickets(Query query);

    Map<TicketStatus, Long> countTicketsByStatus();

    Map<TicketStatusKind, Long> countTicketsByStatusKind();

    Map<String, Long> countTicketsByStatusId();

    long getTotalCount();

    Optional<Long> getAverageResolutionTimeMs();

    int updateStatusBulk(TicketStatus fromStatus, TicketStatus toStatus);

    int reassignTicketsToStatus(String fromStatusId, String toStatusId, TicketStatusKind toKind);

    int reassignTicketsToStatus(Query query, String toStatusId, TicketStatusKind toKind);

    void updateTitle(String ticketId, String title);

    /**
     * Stamps the ticket's last activity and returns the stamped document, so a caller that has to
     * broadcast the change gets {@code statusId} and {@code awaitingClientSince} from the same round
     * trip. Deliberately does not touch {@code updatedAt}.
     */
    Optional<Ticket> updateLastActivityAt(String ticketId, Instant lastActivityAt);

    /** Stamps activity and sets (or, with a null {@code awaitingSince}, clears) the client wait. */
    Optional<Ticket> updateActivityAndAwaiting(String ticketId, Instant lastActivityAt, Instant awaitingSince);

    boolean isSortableField(String field);

    String getDefaultSortField();
}
