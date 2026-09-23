package com.openframe.management.migration;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.timetracking.TimeEntry;
import com.openframe.data.service.TenantIdProvider;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@ChangeUnit(id = "backfill-timeentry-organization-id", order = "007", author = "openframe")
public class BackfillTimeEntryOrganizationIdChangeUnit {

    private static final String TENANT_ID_FIELD = "tenantId";
    private static final String ORGANIZATION_ID_FIELD = "organizationId";
    private static final String TICKET_ID_FIELD = "ticketId";
    private static final String ID_FIELD = "_id";

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();

        Query query = new Query(Criteria.where(TENANT_ID_FIELD).is(tenantId)
                .and(ORGANIZATION_ID_FIELD).is(null)
                .and(TICKET_ID_FIELD).ne(null));

        List<TimeEntry> entries = mongoTemplate.find(query, TimeEntry.class);
        int backfilled = 0;
        int skippedMissingTicket = 0;
        int skippedTicketWithoutOrg = 0;

        Set<String> ticketIds = new HashSet<>();
        for (TimeEntry entry : entries) {
            ticketIds.add(entry.getTicketId());
        }

        Map<String, String> ticketIdToOrgId = new HashMap<>();
        if (!ticketIds.isEmpty()) {
            Query ticketQuery = new Query(Criteria.where(ID_FIELD).in(ticketIds)
                    .and(TENANT_ID_FIELD).is(tenantId));
            List<Ticket> tickets = mongoTemplate.find(ticketQuery, Ticket.class);
            for (Ticket ticket : tickets) {
                if (ticket.getOrganizationId() != null) {
                    ticketIdToOrgId.put(ticket.getId(), ticket.getOrganizationId());
                }
            }
        }

        BulkOperations bulkOps = null;

        for (TimeEntry entry : entries) {
            String organizationId = ticketIdToOrgId.get(entry.getTicketId());

            if (organizationId == null) {
                if (!ticketIdToOrgId.containsKey(entry.getTicketId())) {
                    boolean ticketExists = ticketIds.contains(entry.getTicketId());
                }
            }

            if (organizationId == null) {
                if (ticketIds.contains(entry.getTicketId()) && !ticketIdToOrgId.containsKey(entry.getTicketId())) {
                    skippedTicketWithoutOrg++;
                } else if (!ticketIds.contains(entry.getTicketId())) {
                    skippedMissingTicket++;
                } else {
                    skippedTicketWithoutOrg++;
                }
                continue;
            }

            if (bulkOps == null) {
                bulkOps = mongoTemplate.bulkOps(BulkOperations.BulkMode.UNORDERED, TimeEntry.class);
            }
            Query byId = new Query(Criteria.where(ID_FIELD).is(entry.getId()));
            Update update = new Update().set(ORGANIZATION_ID_FIELD, organizationId);
            bulkOps.updateOne(byId, update);
            backfilled++;
        }

        if (bulkOps != null) {
            bulkOps.execute();
        }

        log.info("Backfilled organizationId on {} time entries (skipped {} missing tickets, {} tickets without org)",
                backfilled, skippedMissingTicket, skippedTicketWithoutOrg);
    }

    @RollbackExecution
    public void rollback() {
    }
}

