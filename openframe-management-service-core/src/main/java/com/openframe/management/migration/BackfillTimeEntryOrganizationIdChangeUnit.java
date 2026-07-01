package com.openframe.management.migration;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.timetracking.TimeEntry;
import com.openframe.data.service.TenantIdProvider;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.List;

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

        for (TimeEntry entry : entries) {
            Query ticketQuery = new Query(Criteria.where(ID_FIELD).is(entry.getTicketId())
                    .and(TENANT_ID_FIELD).is(tenantId));
            Ticket ticket = mongoTemplate.findOne(ticketQuery, Ticket.class);

            if (ticket == null) {
                skippedMissingTicket++;
                continue;
            }

            String organizationId = ticket.getOrganizationId();
            if (organizationId == null) {
                skippedTicketWithoutOrg++;
                continue;
            }

            setOrganizationId(mongoTemplate, entry.getId(), organizationId);
            backfilled++;
        }

        log.info("Backfilled organizationId on {} time entries (skipped {} missing tickets, {} tickets without org)",
                backfilled, skippedMissingTicket, skippedTicketWithoutOrg);
    }

    @RollbackExecution
    public void rollback() {
    }

    private void setOrganizationId(MongoTemplate mongoTemplate, String entryId, String organizationId) {
        Query byId = new Query(Criteria.where(ID_FIELD).is(entryId));
        Update update = new Update().set(ORGANIZATION_ID_FIELD, organizationId);
        mongoTemplate.updateFirst(byId, update, TimeEntry.class);
    }
}
