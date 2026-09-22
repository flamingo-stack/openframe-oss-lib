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
 */
@Slf4j
// runAlways: seeding is what gives a tenant its statuses, and a tenant can appear after this service
// started, so the unit has to re-run on every boot — a one-shot unit would leave those tenants empty.
@ChangeUnit(id = "migrate-ticket-status-model", order = "003", author = "openframe", runAlways = true)
public class MigrateTicketStatusesChangeUnit {

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
