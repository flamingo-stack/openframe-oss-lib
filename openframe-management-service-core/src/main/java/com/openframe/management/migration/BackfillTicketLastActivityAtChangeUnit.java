package com.openframe.management.migration;

import com.mongodb.client.MongoCursor;
import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.ticket.Ticket;
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

import java.time.Instant;
import java.util.Date;
import java.util.List;

/**
 * Seeds {@code lastActivityAt} on tickets that predate activity tracking. Without it the board's
 * staleness filter would skip those tickets entirely — a range query does not match a missing field
 * — and every one of them would read as "no activity" on the card.
 * <p>
 * Two passes, because the better source lives in another collection:
 * <ol>
 *   <li>Every ticket missing the field gets {@code updatedAt}, or {@code createdAt} where even that
 *       is unset. Done in a single server-side update pipeline.</li>
 *   <li>Tickets whose linked dialog has a newer {@code lastMessageAt} are moved forward to it.
 *       {@code updatedAt} only advances on record changes, so for a ticket with a long conversation
 *       and no status move it badly understates real activity.</li>
 * </ol>
 * The dialog collection is read as raw documents on purpose: {@code Dialog} is declared in the SaaS
 * library, which this module does not depend on, and an OSS-only deployment has no such collection —
 * there the second pass simply finds nothing.
 * <p>
 * Idempotent: the first pass only touches documents without the field, the second only moves a
 * timestamp forward.
 */
@Slf4j
@ChangeUnit(id = "backfill-ticket-last-activity-at", order = "012", author = "openframe")
public class BackfillTicketLastActivityAtChangeUnit {

    private static final String TICKETS_COLLECTION = "tickets";
    private static final String DIALOGS_COLLECTION = "dialogs";
    private static final String LAST_ACTIVITY_AT = "lastActivityAt";
    private static final String LAST_MESSAGE_AT = "lastMessageAt";
    private static final String TICKET_ID = "ticketId";
    private static final String TENANT_ID = "tenantId";
    private static final String ID_FIELD = "_id";

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();
        seedFromTicketTimestamps(mongoTemplate, tenantId);
        advanceFromDialogs(mongoTemplate, tenantId);
    }

    @RollbackExecution
    public void rollback() {
    }

    private void seedFromTicketTimestamps(MongoTemplate mongoTemplate, String tenantId) {
        Document filter = new Document(TENANT_ID, tenantId)
                .append(LAST_ACTIVITY_AT, new Document("$exists", false));
        List<Document> pipeline = List.of(new Document("$set",
                new Document(LAST_ACTIVITY_AT, new Document("$ifNull", List.of("$updatedAt", "$createdAt")))));

        UpdateResult result = mongoTemplate.getCollection(TICKETS_COLLECTION).updateMany(filter, pipeline);
        log.info("Seeded {} from ticket timestamps on {} document(s)", LAST_ACTIVITY_AT, result.getModifiedCount());
    }

    private void advanceFromDialogs(MongoTemplate mongoTemplate, String tenantId) {
        Document filter = new Document(TENANT_ID, tenantId)
                .append(TICKET_ID, new Document("$ne", null))
                .append(LAST_MESSAGE_AT, new Document("$ne", null));
        Document projection = new Document(TICKET_ID, 1).append(LAST_MESSAGE_AT, 1);

        long advanced = 0;
        try (MongoCursor<Document> cursor = mongoTemplate.getCollection(DIALOGS_COLLECTION)
                .find(filter).projection(projection).iterator()) {
            while (cursor.hasNext()) {
                Document dialog = cursor.next();
                advanced += advanceTicket(mongoTemplate, dialog);
            }
        }
        log.info("Advanced {} from dialog activity on {} ticket(s)", LAST_ACTIVITY_AT, advanced);
    }

    private long advanceTicket(MongoTemplate mongoTemplate, Document dialog) {
        String ticketId = dialog.getString(TICKET_ID);
        Date lastMessageAt = dialog.getDate(LAST_MESSAGE_AT);
        if (ticketId == null || lastMessageAt == null) {
            return 0;
        }
        Instant activity = lastMessageAt.toInstant();
        // Only ever moves the stamp forward, which is what makes a re-run a no-op.
        Query query = new Query(Criteria.where(ID_FIELD).is(ticketId)
                .and(LAST_ACTIVITY_AT).lt(activity));
        Update update = new Update().set(LAST_ACTIVITY_AT, activity);
        return mongoTemplate.updateFirst(query, update, Ticket.class).getModifiedCount();
    }
}
