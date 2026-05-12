package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatus;
import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TicketRepository extends MongoRepository<Ticket, String>, CustomTicketRepository {

    Optional<Ticket> findByTicketNumber(Integer ticketNumber);

    List<Ticket> findByStatus(TicketStatus status);

    List<Ticket> findByOrganizationId(String organizationId);

    List<Ticket> findByAssignedTo(String assignedTo);

    List<Ticket> findByDeviceId(String deviceId);

    List<Ticket> findByIdIn(List<String> ids);

    @Query("{ '_id': ?0, 'owner.machineId': ?1 }")
    Optional<Ticket> findByIdAndOwnerMachineId(String id, String machineId);

    @Aggregation(pipeline = {
            "{ $match: { 'status': ?0, 'order': { $ne: null } } }",
            "{ $sort: { 'order': 1 } }",
            "{ $limit: 1 }"
    })
    Optional<Ticket> findFirstInColumn(TicketStatus status);

    @Aggregation(pipeline = {
            "{ $match: { 'status': ?0, 'order': { $ne: null } } }",
            "{ $sort: { 'order': -1 } }",
            "{ $limit: 1 }"
    })
    Optional<Ticket> findLastInColumn(TicketStatus status);

    @Aggregation(pipeline = {
            "{ $match: { 'status': ?0, 'order': { $gt: ?1 } } }",
            "{ $sort: { 'order': 1 } }",
            "{ $limit: 1 }"
    })
    Optional<Ticket> findFirstAfter(TicketStatus status, String order);

    @Aggregation(pipeline = {
            "{ $match: { 'status': ?0, 'order': { $lt: ?1 } } }",
            "{ $sort: { 'order': -1 } }",
            "{ $limit: 1 }"
    })
    Optional<Ticket> findFirstBefore(TicketStatus status, String order);
}
