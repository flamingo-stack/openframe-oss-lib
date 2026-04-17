package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.TicketNote;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TicketNoteRepository extends MongoRepository<TicketNote, String> {

    List<TicketNote> findByTicketId(String ticketId);

    List<TicketNote> findByTicketId(String ticketId, Sort sort);

    List<TicketNote> findByTicketIdIn(List<String> ticketIds);

    void deleteByTicketId(String ticketId);
}
