package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatus;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.document.ticket.filter.TicketQueryFilter;
import org.springframework.data.mongodb.core.query.Query;

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

    boolean isSortableField(String field);

    String getDefaultSortField();
}
