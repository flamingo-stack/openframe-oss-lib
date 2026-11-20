package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.TicketAttachment;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TicketAttachmentRepository extends MongoRepository<TicketAttachment, String> {

    List<TicketAttachment> findByTicketId(String ticketId);

    List<TicketAttachment> findByTicketIdIn(List<String> ticketIds);

    void deleteByTicketId(String ticketId);

    Optional<TicketAttachment> findByTicketIdAndStoragePath(String ticketId, String storagePath);
}
