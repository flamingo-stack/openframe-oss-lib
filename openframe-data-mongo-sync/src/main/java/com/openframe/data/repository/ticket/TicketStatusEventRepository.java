package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.TicketStatusEvent;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TicketStatusEventRepository extends MongoRepository<TicketStatusEvent, String> {

    List<TicketStatusEvent> findByTenantIdAndTicketIdOrderByOccurredAtDesc(String tenantId, String ticketId);
}
