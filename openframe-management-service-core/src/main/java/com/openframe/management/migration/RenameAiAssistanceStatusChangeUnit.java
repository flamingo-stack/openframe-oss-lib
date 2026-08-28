package com.openframe.management.migration;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.service.TenantIdProvider;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;

import static com.openframe.data.document.ticket.TicketStatusKind.AI_ASSISTANCE;

/**
 * One-off display-name rename of the {@code AI_ASSISTANCE} system status: "AI Assistance" →
 * "AI Handling". Label only — {@code kind}, {@code systemKey}, {@code position}, the row's
 * {@code _id} and every {@code ticket.statusId} pointing at it stay exactly as they are, so no
 * ticket, transition or board ordering moves.
 *
 * <p>Needed because {@link MigrateTicketStatusesChangeUnit} seeds system statuses with
 * {@code saveIfMissing} — a tenant that already has the row keeps its stored name forever, so
 * changing {@code TicketStatusSeedCatalog.NAME_AI_ASSISTANCE} alone only reaches fresh tenants.
 *
 * <p>Safe as a blanket update: system status names are not user-editable
 * ({@code TicketStatusService} rejects a rename of any non-{@code CUSTOM} status), so there is no
 * tenant customization to lose.
 *
 * <p>Both names are pinned literals rather than a reference to the seed catalog constant: this is
 * a one-shot migration describing a specific historical transition, and a later rename of the
 * constant must not silently change what this unit does for tenants that have not run it yet.
 *
 * <p>Rollback is intentionally empty — restoring the old label would undo the rename for any
 * tenant whose pod rolled back independently, leaving the fleet inconsistent.
 */
@Slf4j
@ChangeUnit(id = "rename-ai-assistance-status-to-ai-handling", order = "011", author = "openframe")
public class RenameAiAssistanceStatusChangeUnit {

    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_KIND = "kind";
    private static final String FIELD_NAME = "name";
    private static final String FIELD_UPDATED_AT = "updatedAt";

    private static final String LEGACY_NAME = "AI Assistance";
    private static final String CANONICAL_NAME = "AI Handling";

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();

        Query query = new Query(Criteria.where(FIELD_TENANT_ID).is(tenantId)
                .and(FIELD_KIND).is(AI_ASSISTANCE.name())
                .and(FIELD_NAME).ne(CANONICAL_NAME));
        Update update = new Update()
                .set(FIELD_NAME, CANONICAL_NAME)
                .set(FIELD_UPDATED_AT, Instant.now());

        UpdateResult result = mongoTemplate.updateMulti(query, update, TicketStatusDefinition.class);
        log.info("Renamed '{}' → '{}' on {} {} status(es), tenantId={}",
                LEGACY_NAME, CANONICAL_NAME, result.getModifiedCount(), AI_ASSISTANCE, tenantId);
    }

    @RollbackExecution
    public void rollback() {
    }
}
