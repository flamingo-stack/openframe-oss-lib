package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatusKind;
import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TicketRepository extends MongoRepository<Ticket, String>, CustomTicketRepository {

    Optional<Ticket> findByTenantIdAndTicketNumber(String tenantId, Integer ticketNumber);

    Optional<Ticket> findByTenantIdAndId(String tenantId, String id);

    List<Ticket> findByTenantIdAndStatusKind(String tenantId, TicketStatusKind statusKind);

    List<Ticket> findByTenantIdAndStatusId(String tenantId, String statusId);

    List<Ticket> findByTenantIdAndOrganizationId(String tenantId, String organizationId);

    List<Ticket> findByTenantIdAndAssignedTo(String tenantId, String assignedTo);

    List<Ticket> findByTenantIdAndDeviceId(String tenantId, String deviceId);

    List<Ticket> findByTenantIdAndIdIn(String tenantId, List<String> ids);

    long countByTenantIdAndStatusId(String tenantId, String statusId);

    @Query("{ 'tenantId': ?0, '_id': ?1, 'owner.machineId': ?2 }")
    Optional<Ticket> findByTenantIdAndIdAndOwnerMachineId(String tenantId, String id, String machineId);

    @Aggregation(pipeline = {
            "{ $match: { 'tenantId': ?0, 'statusId': ?1, 'order': { $ne: null } } }",
            "{ $sort: { 'order': 1 } }",
            "{ $limit: 1 }"
    })
    Optional<Ticket> findFirstInColumn(String tenantId, String statusId);

    @Aggregation(pipeline = {
            "{ $match: { 'tenantId': ?0, 'statusId': ?1, 'order': { $ne: null } } }",
            "{ $sort: { 'order': -1 } }",
            "{ $limit: 1 }"
    })
    Optional<Ticket> findLastInColumn(String tenantId, String statusId);

    @Aggregation(pipeline = {
            "{ $match: { 'tenantId': ?0, 'statusId': ?1, 'order': { $gt: ?2 } } }",
            "{ $sort: { 'order': 1 } }",
            "{ $limit: 1 }"
    })
    Optional<Ticket> findFirstAfter(String tenantId, String statusId, String order);

    @Aggregation(pipeline = {
            "{ $match: { 'tenantId': ?0, 'statusId': ?1, 'order': { $lt: ?2 } } }",
            "{ $sort: { 'order': -1 } }",
            "{ $limit: 1 }"
    })
    Optional<Ticket> findFirstBefore(String tenantId, String statusId, String order);
}
