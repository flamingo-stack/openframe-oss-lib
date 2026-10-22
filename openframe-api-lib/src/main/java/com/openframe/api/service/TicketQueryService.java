package com.openframe.api.service;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.filter.TicketQueryFilter;
import com.openframe.data.repository.ticket.TicketRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

// TODO: Expand with full cursor pagination/sort methods when PSA migrates from ai-agent to OSS
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class TicketQueryService {

    private static final String SORT_FIELD_CREATED_AT = "createdAt";
    private static final String SORT_DIRECTION_DESC = "DESC";

    private final TicketRepository ticketRepository;

    public Optional<Ticket> findById(String ticketId) {
        return ticketRepository.findById(ticketId);
    }

    public List<Ticket> searchTickets(TicketQueryFilter filter, String search, int limit) {
        return searchTickets(filter, search, null, limit);
    }

    // afterTicketId is the id of the last ticket a previous call returned, or null to start from the
    // beginning. The page order is (createdAt desc, _id desc), so that id alone resumes it.
    public List<Ticket> searchTickets(TicketQueryFilter filter, String search, String afterTicketId, int limit) {
        Query query = ticketRepository.buildTicketQuery(filter, search, null, null);
        return ticketRepository.findTicketsWithCursor(
                query, afterTicketId, limit, SORT_FIELD_CREATED_AT, SORT_DIRECTION_DESC);
    }
}
