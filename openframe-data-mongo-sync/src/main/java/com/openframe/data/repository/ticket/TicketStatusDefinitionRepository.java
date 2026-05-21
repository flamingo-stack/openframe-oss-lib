package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusKind;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TicketStatusDefinitionRepository extends MongoRepository<TicketStatusDefinition, String> {

    List<TicketStatusDefinition> findAllByOrderByPositionAsc();

    Optional<TicketStatusDefinition> findByKind(TicketStatusKind kind);

    Optional<TicketStatusDefinition> findByName(String name);

    List<TicketStatusDefinition> findByKindOrderByPositionAsc(TicketStatusKind kind);

    long countByKind(TicketStatusKind kind);

    boolean existsByName(String name);
}
