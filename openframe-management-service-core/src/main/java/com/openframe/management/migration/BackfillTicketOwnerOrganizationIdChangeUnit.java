package com.openframe.management.migration;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.service.TenantIdProvider;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.List;

/**
 * Gives every client-owned ticket the organization snapshot its owner now carries
 * ({@code owner.organizationId}): the ticket's own organization where it has one (captured from the
 * device at creation), otherwise the device's current organization. Re-runs are no-ops, the filters
 * only match tickets still missing the snapshot.
 */
@Slf4j
@ChangeUnit(id = "backfill-ticket-owner-organization-id", order = "021", author = "openframe")
public class BackfillTicketOwnerOrganizationIdChangeUnit {

    private static final String TICKETS = "tickets";
    private static final String MACHINES = "machines";
    private static final String TENANT_ID = "tenantId";
    private static final String ORGANIZATION_ID = "organizationId";
    private static final String MACHINE_ID = "machineId";
    private static final String OWNER_TYPE = "owner.ticketOwnerType";
    private static final String OWNER_MACHINE_ID = "owner.machineId";
    private static final String OWNER_ORGANIZATION_ID = "owner.organizationId";
    private static final String CLIENT = "CLIENT";

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();
        long fromTicket = copyFromTicketOrganization(mongoTemplate, tenantId);
        long fromMachine = copyFromMachineOrganization(mongoTemplate, tenantId);
        log.info("Backfilled {} on {} ticket(s) from the ticket and {} from the machine, tenantId={}",
                OWNER_ORGANIZATION_ID, fromTicket, fromMachine, tenantId);
    }

    @RollbackExecution
    public void rollback() {
    }

    private long copyFromTicketOrganization(MongoTemplate mongoTemplate, String tenantId) {
        Document filter = missingSnapshot(tenantId).append(ORGANIZATION_ID, new Document("$ne", null));
        List<Document> pipeline = List.of(new Document("$set",
                new Document(OWNER_ORGANIZATION_ID, "$" + ORGANIZATION_ID)));
        UpdateResult result = mongoTemplate.getCollection(TICKETS).updateMany(filter, pipeline);
        return result.getModifiedCount();
    }

    private long copyFromMachineOrganization(MongoTemplate mongoTemplate, String tenantId) {
        Query remaining = new Query(missingSnapshotCriteria(tenantId).and(OWNER_MACHINE_ID).ne(null));
        List<String> machineIds = mongoTemplate.findDistinct(remaining, OWNER_MACHINE_ID, TICKETS, String.class);

        long modified = 0;
        for (String machineId : machineIds) {
            String organizationId = currentOrganization(mongoTemplate, tenantId, machineId);
            if (organizationId == null) {
                log.warn("Machine {} has no organization; its tickets keep no owner snapshot", machineId);
                continue;
            }
            Query tickets = new Query(missingSnapshotCriteria(tenantId).and(OWNER_MACHINE_ID).is(machineId));
            Update stamp = new Update().set(OWNER_ORGANIZATION_ID, organizationId);
            modified += mongoTemplate.updateMulti(tickets, stamp, TICKETS).getModifiedCount();
        }
        return modified;
    }

    private String currentOrganization(MongoTemplate mongoTemplate, String tenantId, String machineId) {
        Query machine = new Query(Criteria.where(TENANT_ID).is(tenantId).and(MACHINE_ID).is(machineId));
        machine.fields().include(ORGANIZATION_ID);
        Document found = mongoTemplate.findOne(machine, Document.class, MACHINES);
        return found == null ? null : found.getString(ORGANIZATION_ID);
    }

    private static Document missingSnapshot(String tenantId) {
        return new Document(TENANT_ID, tenantId)
                .append(OWNER_TYPE, CLIENT)
                .append(OWNER_ORGANIZATION_ID, new Document("$exists", false));
    }

    private static Criteria missingSnapshotCriteria(String tenantId) {
        return Criteria.where(TENANT_ID).is(tenantId)
                .and(OWNER_TYPE).is(CLIENT)
                .and(OWNER_ORGANIZATION_ID).exists(false);
    }
}
