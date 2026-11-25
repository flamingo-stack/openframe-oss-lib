package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.TicketNote;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.ReadPreference;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TicketNoteRepository extends MongoRepository<TicketNote, String> {

    List<TicketNote> findByTicketId(String ticketId);

    List<TicketNote> findByTicketId(String ticketId, Sort sort);

    List<TicketNote> findByTicketIdIn(List<String> ticketIds);

    void deleteByTicketId(String ticketId);

    // primary on purpose: a retried email resume must see the note its failed attempt saved a moment ago
    @ReadPreference("primary")
    @Query(value = "{ '_id': ?0 }", exists = true)
    boolean existsByIdFromPrimary(String noteId);
}
