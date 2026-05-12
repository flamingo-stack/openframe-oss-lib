package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusKind;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TicketStatusDefinitionRepository extends MongoRepository<TicketStatusDefinition, String> {

    List<TicketStatusDefinition> findByTenantIdOrderByPositionAsc(String tenantId);

    Optional<TicketStatusDefinition> findByTenantIdAndId(String tenantId, String id);

    Optional<TicketStatusDefinition> findByTenantIdAndKind(String tenantId, TicketStatusKind kind);

    Optional<TicketStatusDefinition> findByTenantIdAndName(String tenantId, String name);

    List<TicketStatusDefinition> findByTenantIdAndKindOrderByPositionAsc(String tenantId, TicketStatusKind kind);

    long countByTenantIdAndKind(String tenantId, TicketStatusKind kind);

    boolean existsByTenantIdAndName(String tenantId, String name);
}
