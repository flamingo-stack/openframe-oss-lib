package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.TicketStatusHistory;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

@TenantAwareRepository
public interface TicketStatusHistoryRepository extends MongoRepository<TicketStatusHistory, String> {

    List<TicketStatusHistory> findByTicketIdOrderByCreatedAtAsc(String ticketId);
}
