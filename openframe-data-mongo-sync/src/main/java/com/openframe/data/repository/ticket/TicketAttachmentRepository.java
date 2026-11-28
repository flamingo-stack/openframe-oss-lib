package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.TicketAttachment;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.ReadPreference;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/** Reads and writes metadata for files linked to tickets. */
@Repository
public interface TicketAttachmentRepository extends MongoRepository<TicketAttachment, String>,
        CustomTicketAttachmentRepository {

    List<TicketAttachment> findByTicketId(String ticketId);

    List<TicketAttachment> findByTicketIdIn(List<String> ticketIds);

    void deleteByTicketId(String ticketId);

    // primary on purpose: a retried email resume must see the row its failed attempt saved a moment ago
    @ReadPreference("primary")
    @Query("{ 'ticketId': ?0, 'storagePath': ?1 }")
    Optional<TicketAttachment> findByTicketIdAndStoragePathFromPrimary(String ticketId, String storagePath);
}
