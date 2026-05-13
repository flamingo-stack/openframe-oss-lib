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

    Query buildTicketQuery(String tenantId,
                           TicketQueryFilter filter,
                           String search,
                           List<String> restrictToTicketIds,
                           String ownerMachineId);

    // TODO(lifecycle-rollout): drop buildLegacyTicketQuery + countTicketsByStatusLegacy + getAverageResolutionTimeMsLegacy after rollout
    Query buildLegacyTicketQuery(TicketQueryFilter filter,
                                 String search,
                                 List<String> restrictToTicketIds,
                                 String ownerMachineId);

    List<Ticket> findTicketsWithCursor(Query query,
                                       String cursor,
                                       int limit,
                                       String sortField,
                                       String sortDirection);

    long countTickets(Query query);

    Map<TicketStatus, Long> countTicketsByStatus(String tenantId);

    Map<TicketStatus, Long> countTicketsByStatusLegacy();

    Map<TicketStatusKind, Long> countTicketsByStatusKind(String tenantId);

    Map<String, Long> countTicketsByStatusId(String tenantId);

    long getTotalCount(String tenantId);

    Optional<Long> getAverageResolutionTimeMs(String tenantId);

    Optional<Long> getAverageResolutionTimeMsLegacy();

    int reassignTicketsToStatus(String tenantId,
                                String fromStatusId,
                                String toStatusId,
                                TicketStatusKind toKind);

    void updateTitle(String tenantId, String ticketId, String title);

    boolean isSortableField(String field);

    String getDefaultSortField();
}
