package com.openframe.data.repository.ticket;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.Ticket.Fields;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.util.List;

// The projections' ticket writes. Not TicketRepository: that one is tenant-aware and not created in the shared stream,
// where the projections run, so every write here names its tenant. Ticket.class makes Spring add $inc on @Version, so a
// user holding an old copy of a ticket gets a conflict instead of overwriting the new name.
@Repository
@RequiredArgsConstructor
public class TicketProjectionRepository {

    private final MongoOperations mongoOperations;

    public long updateOrganizationName(String tenantId, String organizationId, String organizationName) {
        Criteria outdatedNames = matchTicketsToUpdateOrganizationName(tenantId, organizationId, organizationName);
        Query query = new Query(outdatedNames);
        Update update = new Update().set(Fields.organizationName, organizationName);
        UpdateResult result = mongoOperations.updateMulti(query, update, Ticket.class);
        return result.getModifiedCount();
    }

    public long countTicketsToUpdateOrganizationName(String tenantId, String organizationId, String organizationName, int limit) {
        Criteria outdatedNames = matchTicketsToUpdateOrganizationName(tenantId, organizationId, organizationName);
        Query query = new Query(outdatedNames).limit(limit);
        return mongoOperations.count(query, Ticket.class);
    }

    // One batch in _id order after lastId (null for the first); returns its last _id, or null when none is left.
    public String updateOrganizationNameBatch(String tenantId,
                                              String organizationId,
                                              String organizationName,
                                              String lastId,
                                              int batchSize) {
        Criteria outdatedNames = matchTicketsToUpdateOrganizationName(tenantId, organizationId, organizationName);
        List<String> batchIds = findIdsAfter(outdatedNames, lastId, batchSize);
        if (batchIds.isEmpty()) {
            return null;
        }
        Criteria batchNames = matchTicketsToUpdateOrganizationName(tenantId, organizationId, organizationName)
                .and(Fields.id).in(batchIds);
        Query query = new Query(batchNames);
        Update update = new Update().set(Fields.organizationName, organizationName);
        mongoOperations.updateMulti(query, update, Ticket.class);
        return batchIds.getLast();
    }

    // The user's full name is both the assignee's and the resolver's name; each is matched by its own field.
    public long updateUserNames(String tenantId, String userId, String userName) {
        Criteria outdatedAssignedNames = matchTicketsToUpdateAssignedName(tenantId, userId, userName);
        Query assignedQuery = new Query(outdatedAssignedNames);
        Update assignedUpdate = new Update().set(Fields.assignedName, userName);
        UpdateResult assigned = mongoOperations.updateMulti(assignedQuery, assignedUpdate, Ticket.class);

        Criteria outdatedResolvedByNames = matchTicketsToUpdateResolvedByName(tenantId, userId, userName);
        Query resolvedQuery = new Query(outdatedResolvedByNames);
        Update resolvedUpdate = new Update().set(Fields.resolvedByName, userName);
        UpdateResult resolved = mongoOperations.updateMulti(resolvedQuery, resolvedUpdate, Ticket.class);

        return assigned.getModifiedCount() + resolved.getModifiedCount();
    }

    public long countTicketsToUpdateUserName(String tenantId, String userId, String userName, int limit) {
        Criteria outdatedNames = matchTicketsToUpdateUserName(tenantId, userId, userName);
        Query query = new Query(outdatedNames).limit(limit);
        return mongoOperations.count(query, Ticket.class);
    }

    // One batch of tickets with either name outdated, in _id order after lastId; returns its last _id, or null when none is left.
    public String updateUserNamesBatch(String tenantId, String userId, String userName, String lastId, int batchSize) {
        Criteria outdatedNames = matchTicketsToUpdateUserName(tenantId, userId, userName);
        List<String> batchIds = findIdsAfter(outdatedNames, lastId, batchSize);
        if (batchIds.isEmpty()) {
            return null;
        }
        Criteria batchAssignedNames = matchTicketsToUpdateAssignedName(tenantId, userId, userName)
                .and(Fields.id).in(batchIds);
        Query assignedQuery = new Query(batchAssignedNames);
        Update assignedUpdate = new Update().set(Fields.assignedName, userName);
        mongoOperations.updateMulti(assignedQuery, assignedUpdate, Ticket.class);

        Criteria batchResolvedNames = matchTicketsToUpdateResolvedByName(tenantId, userId, userName)
                .and(Fields.id).in(batchIds);
        Query resolvedQuery = new Query(batchResolvedNames);
        Update resolvedUpdate = new Update().set(Fields.resolvedByName, userName);
        mongoOperations.updateMulti(resolvedQuery, resolvedUpdate, Ticket.class);
        return batchIds.getLast();
    }

    public long updateDeviceHostname(String tenantId, String machineId, String hostname) {
        Criteria ticketsToUpdate = matchTicketsToUpdateDeviceHostname(tenantId, machineId, hostname);
        Query query = new Query(ticketsToUpdate);
        Update update = new Update().set(Fields.deviceHostname, hostname);
        UpdateResult result = mongoOperations.updateMulti(query, update, Ticket.class);
        return result.getModifiedCount();
    }

    public long countTicketsToUpdateDeviceHostname(String tenantId, String machineId, String hostname, int limit) {
        Criteria ticketsToUpdate = matchTicketsToUpdateDeviceHostname(tenantId, machineId, hostname);
        Query query = new Query(ticketsToUpdate).limit(limit);
        return mongoOperations.count(query, Ticket.class);
    }

    // One batch in _id order after lastId (null for the first); returns its last _id, or null when none is left.
    public String updateDeviceHostnameBatch(String tenantId, String machineId, String hostname, String lastId, int batchSize) {
        Criteria ticketsToUpdate = matchTicketsToUpdateDeviceHostname(tenantId, machineId, hostname);
        List<String> batchIds = findIdsAfter(ticketsToUpdate, lastId, batchSize);
        if (batchIds.isEmpty()) {
            return null;
        }
        Criteria batchTickets = matchTicketsToUpdateDeviceHostname(tenantId, machineId, hostname)
                .and(Fields.id).in(batchIds);
        Query query = new Query(batchTickets);
        Update update = new Update().set(Fields.deviceHostname, hostname);
        mongoOperations.updateMulti(query, update, Ticket.class);
        return batchIds.getLast();
    }

    private List<String> findIdsAfter(Criteria criteria, String lastId, int batchSize) {
        if (lastId != null) {
            criteria.and(Fields.id).gt(lastId);
        }
        Query query = new Query(criteria).with(Sort.by(Fields.id)).limit(batchSize);
        query.fields().include(Fields.id);
        return mongoOperations.find(query, Ticket.class).stream()
                .map(Ticket::getId)
                .toList();
    }

    private static Criteria matchTicketsToUpdateOrganizationName(String tenantId, String organizationId,
                                                                 String organizationName) {
        return Criteria.where(Fields.tenantId).is(tenantId)
                .and(Fields.organizationId).is(organizationId)
                .and(Fields.organizationName).ne(organizationName);
    }

    private static Criteria matchTicketsToUpdateDeviceHostname(String tenantId, String machineId, String hostname) {
        return Criteria.where(Fields.tenantId).is(tenantId)
                .and(Fields.deviceId).is(machineId)
                .and(Fields.deviceHostname).ne(hostname);
    }

    private static Criteria matchTicketsToUpdateAssignedName(String tenantId, String userId, String userName) {
        return Criteria.where(Fields.tenantId).is(tenantId)
                .and(Fields.assignedTo).is(userId)
                .and(Fields.assignedName).ne(userName);
    }

    private static Criteria matchTicketsToUpdateResolvedByName(String tenantId, String userId, String userName) {
        return Criteria.where(Fields.tenantId).is(tenantId)
                .and(Fields.resolvedById).is(userId)
                .and(Fields.resolvedByName).ne(userName);
    }

    private static Criteria matchTicketsToUpdateUserName(String tenantId, String userId, String userName) {
        Criteria assigned = Criteria.where(Fields.assignedTo).is(userId).and(Fields.assignedName).ne(userName);
        Criteria resolved = Criteria.where(Fields.resolvedById).is(userId).and(Fields.resolvedByName).ne(userName);
        return Criteria.where(Fields.tenantId).is(tenantId).orOperator(assigned, resolved);
    }
}
