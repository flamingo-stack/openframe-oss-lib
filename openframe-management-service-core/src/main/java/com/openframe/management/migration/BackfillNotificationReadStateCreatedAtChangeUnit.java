package com.openframe.management.migration;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.service.TenantIdProvider;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.List;

/**
 * Backfills the {@code createdAt} field on notification_read_states so the 30-day TTL index also
 * expires rows created before the field existed. The value is derived from the document's ObjectId
 * {@code _id}, which embeds the insertion time (≈ when the read-state and its notification were
 * created). Only documents whose {@code _id} is an ObjectId are touched; any others are left as-is.
 * Idempotent — skips documents that already have {@code createdAt}.
 */
@Slf4j
@ChangeUnit(id = "backfill-notification-read-state-created-at", order = "007", author = "openframe")
public class BackfillNotificationReadStateCreatedAtChangeUnit {

    private static final String COLLECTION = "notification_read_states";
    private static final String CREATED_AT_FIELD = "createdAt";

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();
        Document filter = new Document("tenantId", tenantId)
                .append(CREATED_AT_FIELD, new Document("$exists", false))
                .append("_id", new Document("$type", "objectId"));
        List<Document> pipeline = List.of(
                new Document("$set", new Document(CREATED_AT_FIELD, new Document("$toDate", "$_id"))));
        UpdateResult result = mongoTemplate.getCollection(COLLECTION).updateMany(filter, pipeline);
        log.info("Backfilled {} from _id on {} notification_read_states document(s)",
                CREATED_AT_FIELD, result.getModifiedCount());
    }

    @RollbackExecution
    public void rollback() {
    }
}
