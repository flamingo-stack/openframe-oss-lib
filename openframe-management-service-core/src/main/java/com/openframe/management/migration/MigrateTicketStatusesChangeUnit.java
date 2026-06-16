package com.openframe.management.migration;

import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.seed.ticket.TicketStatusSeedCatalog;
import com.openframe.data.service.TenantIdProvider;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.openframe.data.document.ticket.TicketStatusKind.AI_ASSISTANCE;
import static com.openframe.data.document.ticket.TicketStatusKind.ARCHIVED;
import static com.openframe.data.document.ticket.TicketStatusKind.RESOLVED;
import static com.openframe.data.document.ticket.TicketStatusKind.TECH_REQUIRED;
import static org.springframework.util.StringUtils.hasText;

@Slf4j
// One-shot migration of any remaining legacy enum-status tickets to the custom-status model
// (statusId/statusKind). Reads the raw `status` field via bson Document, so it stays valid after
// the legacy field/enum are removed from the Ticket POJO.
@ChangeUnit(id = "migrate-ticket-status-model", order = "003", author = "openframe")
public class MigrateTicketStatusesChangeUnit {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_KIND = "kind";
    private static final String FIELD_NAME = "name";
    private static final String FIELD_STATUS_ID = "statusId";
    private static final String FIELD_STATUS_KIND = "statusKind";
    private static final String FIELD_LEGACY_STATUS = "status";
    private static final String FIELD_UPDATED_AT = "updatedAt";
    private static final String COLLECTION_TICKETS = "tickets";

    private static final String LEGACY_ON_HOLD = "ON_HOLD";

    private static final Map<String, TicketStatusKind> LEGACY_TO_KIND = Map.of(
            "ACTIVE", AI_ASSISTANCE,
            "TECH_REQUIRED", TECH_REQUIRED,
            "RESOLVED", RESOLVED,
            "ARCHIVED", ARCHIVED
    );

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider) {
        log.info("Migrate ticket statuses: starting");

        String tenantId = tenantIdProvider.getTenantId();
        seedStatuses(mongoTemplate);
        migrateTickets(mongoTemplate, tenantId);

        log.info("Migrate ticket statuses: complete");
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

    private void migrateTickets(MongoTemplate mongoTemplate, String tenantId) {
        List<Document> legacyTickets = findLegacyTickets(mongoTemplate, tenantId);
        log.info("Migrate ticket statuses: {} legacy ticket(s)", legacyTickets.size());
        int migrated = 0;
        int skipped = 0;
        for (Document ticket : legacyTickets) {
            if (migrateOneSafely(mongoTemplate, ticket)) {
                migrated++;
            } else {
                skipped++;
            }
        }
        log.info("Migrate ticket statuses: migrated={} skipped={}", migrated, skipped);
    }

    private List<Document> findLegacyTickets(MongoTemplate mongoTemplate, String tenantId) {
        Query query = new Query(Criteria.where("tenantId").is(tenantId)
                .and(FIELD_STATUS_ID).exists(false));
        return mongoTemplate.find(query, Document.class, COLLECTION_TICKETS);
    }

    private boolean migrateOneSafely(MongoTemplate mongoTemplate, Document ticket) {
        Object id = ticket.get(FIELD_ID);
        try {
            return migrateOne(mongoTemplate, ticket);
        } catch (Exception e) {
            log.error("Migrate ticket statuses: failed for ticket {}", id, e);
            return false;
        }
    }

    private boolean migrateOne(MongoTemplate mongoTemplate, Document ticket) {
        Object id = ticket.get(FIELD_ID);
        String legacyStatus = ticket.getString(FIELD_LEGACY_STATUS);
        if (!hasText(legacyStatus)) {
            log.warn("Migrate ticket statuses: ticket {} has no legacy status; skipping", id);
            return false;
        }
        TicketStatusDefinition target = resolveTarget(mongoTemplate, legacyStatus);
        applyUpdate(mongoTemplate, id, target);
        return true;
    }

    private TicketStatusDefinition resolveTarget(MongoTemplate mongoTemplate, String legacyStatus) {
        if (isOnHold(legacyStatus)) {
            return resolveOnHoldTarget(mongoTemplate);
        }
        TicketStatusKind kind = LEGACY_TO_KIND.get(legacyStatus);
        if (kind == null) {
            throw new IllegalStateException("Unknown legacy ticket status: " + legacyStatus);
        }
        return resolveByKind(mongoTemplate, kind);
    }

    private TicketStatusDefinition resolveOnHoldTarget(MongoTemplate mongoTemplate) {
        return findByName(mongoTemplate, TicketStatusSeedCatalog.NAME_ON_HOLD)
                .orElseGet(() -> fallbackOnHold(mongoTemplate));
    }

    private TicketStatusDefinition fallbackOnHold(MongoTemplate mongoTemplate) {
        log.warn("Migrate ticket statuses: '{}' missing; falling back to TECH_REQUIRED",
                TicketStatusSeedCatalog.NAME_ON_HOLD);
        return resolveByKind(mongoTemplate, TECH_REQUIRED);
    }

    private TicketStatusDefinition resolveByKind(MongoTemplate mongoTemplate, TicketStatusKind kind) {
        Query query = new Query(Criteria.where(FIELD_KIND).is(kind.name()));
        TicketStatusDefinition found = mongoTemplate.findOne(query, TicketStatusDefinition.class);
        if (found == null) {
            throw new IllegalStateException("System status " + kind + " missing");
        }
        return found;
    }

    private Optional<TicketStatusDefinition> findByName(MongoTemplate mongoTemplate, String name) {
        Query query = new Query(Criteria.where(FIELD_NAME).is(name));
        return Optional.ofNullable(mongoTemplate.findOne(query, TicketStatusDefinition.class));
    }

    private boolean isOnHold(String legacyStatus) {
        return LEGACY_ON_HOLD.equals(legacyStatus);
    }

    private void applyUpdate(MongoTemplate mongoTemplate, Object id, TicketStatusDefinition target) {
        Query query = new Query(Criteria.where(FIELD_ID).is(id));
        Update update = new Update()
                .set(FIELD_STATUS_ID, target.getId())
                .set(FIELD_STATUS_KIND, target.getKind().name())
                .set(FIELD_UPDATED_AT, Instant.now())
                .unset(FIELD_LEGACY_STATUS);
        mongoTemplate.updateFirst(query, update, COLLECTION_TICKETS);
    }
}
