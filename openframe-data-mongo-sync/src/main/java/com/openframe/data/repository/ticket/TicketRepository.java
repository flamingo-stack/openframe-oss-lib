package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.ReadPreference;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
@TenantAwareRepository
public interface TicketRepository extends MongoRepository<Ticket, String>, CustomTicketRepository {

    Optional<Ticket> findByTicketNumber(Integer ticketNumber);

    List<Ticket> findByIdIn(List<String> ids);

    @Query("{ '_id': ?0, 'owner.machineId': ?1 }")
    Optional<Ticket> findByIdAndOwnerMachineId(String id, String machineId);

    @Query("{ 'ticketNumber': ?0, 'owner.machineId': ?1 }")
    Optional<Ticket> findByTicketNumberAndOwnerMachineId(Integer ticketNumber, String machineId);

    long countByStatusId(String statusId);

    // primary on purpose: a retried write-ahead resume must see the ticket its failed attempt saved a moment ago
    @ReadPreference("primary")
    @Query("{ '_id': ?0 }")
    Optional<Ticket> findByIdFromPrimary(String ticketId);

    // primary on purpose: a retried write-ahead resume must see the ticket its failed attempt saved a moment ago
    @ReadPreference("primary")
    @Query(value = "{ '_id': ?0 }", exists = true)
    boolean existsByIdFromPrimary(String ticketId);

    @Aggregation(pipeline = {
            "{ $match: { 'tenantId': ?1, 'statusId': ?0, 'order': { $ne: null } } }",
            "{ $sort: { 'order': 1 } }",
            "{ $limit: 1 }"
    })
    Optional<Ticket> findFirstInColumnByStatusId(String statusId, String tenantId);

    @Aggregation(pipeline = {
            "{ $match: { 'tenantId': ?2, 'statusId': ?0, 'order': { $gt: ?1 } } }",
            "{ $sort: { 'order': 1 } }",
            "{ $limit: 1 }"
    })
    Optional<Ticket> findFirstAfterByStatusId(String statusId, String order, String tenantId);

    @Aggregation(pipeline = {
            "{ $match: { 'tenantId': ?2, 'statusId': ?0, 'order': { $lt: ?1 } } }",
            "{ $sort: { 'order': -1 } }",
            "{ $limit: 1 }"
    })
    Optional<Ticket> findFirstBeforeByStatusId(String statusId, String order, String tenantId);
}
