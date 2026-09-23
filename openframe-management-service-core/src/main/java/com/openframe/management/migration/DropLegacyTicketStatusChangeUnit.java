package com.openframe.management.migration;

import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

/**
 * Clears the legacy {@code status} field from tickets. Nothing writes it since statuses moved to
 * the lifecycle model, so what is left on existing documents is a frozen snapshot of the day of the
 * cut-over — dead weight that reads as if it were current. The {@code status_order} index went with
 * it: it existed only to sort by that field.
 *
 * <p>Clients that still ask for the legacy status keep working — it is derived from the lifecycle
 * kind on the way out.
 */
@Slf4j
@ChangeUnit(id = "drop-legacy-ticket-status", order = "015", author = "openframe")
public class DropLegacyTicketStatusChangeUnit {

    private static final String COLLECTION = "tickets";
    private static final String LEGACY_STATUS_FIELD = "status";
    private static final String LEGACY_INDEX = "status_order";

    @Execution
    public void execution(MongoTemplate mongoTemplate) {
        dropLegacyIndex(mongoTemplate);
        unsetLegacyStatus(mongoTemplate);
    }

    @RollbackExecution
    public void rollback() {
    }

    private void unsetLegacyStatus(MongoTemplate mongoTemplate) {
        Query query = new Query(Criteria.where(LEGACY_STATUS_FIELD).exists(true));
        Update update = new Update().unset(LEGACY_STATUS_FIELD);
        long cleared = mongoTemplate.updateMulti(query, update, COLLECTION).getModifiedCount();
        log.info("Dropped the legacy ticket status from {} document(s)", cleared);
    }

    /**
     * A tenant provisioned after the field was already gone never had the index — dropping it then
     * is not a failure, and the boot must not stop on it.
     */
    private void dropLegacyIndex(MongoTemplate mongoTemplate) {
        try {
            mongoTemplate.indexOps(COLLECTION).dropIndex(LEGACY_INDEX);
            log.info("Dropped index '{}' on {}", LEGACY_INDEX, COLLECTION);
        } catch (RuntimeException e) {
            log.debug("Index '{}' not present on {}; nothing to drop", LEGACY_INDEX, COLLECTION);
        }
    }
}
