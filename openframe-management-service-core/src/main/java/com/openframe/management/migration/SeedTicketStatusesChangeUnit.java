package com.openframe.management.migration;

import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.seed.ticket.TicketStatusSeedCatalog;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

/**
 * Gives a tenant its ticket status board: the four system statuses plus the "On Hold" custom one
 * every tenant starts with. Admins own the board from there — a status they renamed or deleted must
 * not come back, so seeding only ever adds what is missing.
 *
 * <p>One-shot: a tenant is a cluster of its own with its own database, so a tenant that appears
 * later brings a fresh changelog and seeds on its first boot. The id is new on purpose — under the
 * old one the predecessor is already recorded as executed on every tenant, and a tenant that never
 * seeded (the feature flag that used to gate this was off) would stay without a board forever.
 */
@Slf4j
@ChangeUnit(id = "seed-ticket-statuses", order = "003", author = "openframe")
public class SeedTicketStatusesChangeUnit {

    private static final String FIELD_NAME = "name";

    @Execution
    public void execution(MongoTemplate mongoTemplate) {
        log.info("Seed ticket statuses: starting");
        seedStatuses(mongoTemplate);
        log.info("Seed ticket statuses: complete");
    }

    @RollbackExecution
    public void rollback() {
    }

    private void seedStatuses(MongoTemplate mongoTemplate) {
        TicketStatusSeedCatalog.systemStatuses().forEach(s -> saveIfMissing(mongoTemplate, s));
        if (existsByName(mongoTemplate, TicketStatusSeedCatalog.NAME_ON_HOLD)) {
            return;
        }
        saveIfMissing(mongoTemplate, TicketStatusSeedCatalog.onHoldCustom());
    }

    private void saveIfMissing(MongoTemplate mongoTemplate, TicketStatusDefinition definition) {
        try {
            mongoTemplate.save(definition);
        } catch (DuplicateKeyException e) {
            log.debug("Status already exists: kind={} name={}", definition.getKind(), definition.getName());
        }
    }

    private boolean existsByName(MongoTemplate mongoTemplate, String name) {
        Query query = new Query(Criteria.where(FIELD_NAME).is(name));
        return mongoTemplate.exists(query, TicketStatusDefinition.class);
    }
}
