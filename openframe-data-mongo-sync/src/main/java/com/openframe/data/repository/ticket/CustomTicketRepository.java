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

    // TODO(lifecycle-rollout): drop all methods in this Legacy block after rollout
    // ===== Legacy (used when lifecycle feature flag is OFF) =====

    default Query buildTicketQuery(TicketQueryFilter filter) {
        return buildTicketQuery(filter, null, null, null);
    }

    Query buildTicketQuery(TicketQueryFilter filter, String search,
                           List<String> restrictToTicketIds, String ownerMachineId);

    Map<TicketStatus, Long> countTicketsByStatus();

    long getTotalCount();

    Optional<Long> getAverageResolutionTimeMs();

    int updateStatusBulk(TicketStatus fromStatus, TicketStatus toStatus);

    void updateTitle(String ticketId, String title);

    // ===== Lifecycle feature (used when lifecycle feature flag is ON) =====

    Query buildTicketQuery(String tenantId,
                           TicketQueryFilter filter,
                           String search,
                           List<String> restrictToTicketIds,
                           String ownerMachineId);

    Map<TicketStatusKind, Long> countTicketsByStatusKind(String tenantId);

    Map<String, Long> countTicketsByStatusId(String tenantId);

    long getTotalCount(String tenantId);

    Optional<Long> getAverageResolutionTimeMs(String tenantId);

    int reassignTicketsToStatus(String tenantId,
                                String fromStatusId,
                                String toStatusId,
                                TicketStatusKind toKind);

    void updateTitle(String tenantId, String ticketId, String title);

    // ===== Shared =====

    List<Ticket> findTicketsWithCursor(Query query,
                                       String cursor,
                                       int limit,
                                       String sortField,
                                       String sortDirection);

    long countTickets(Query query);

    boolean isSortableField(String field);

    String getDefaultSortField();
}
