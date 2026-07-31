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
 * Backfills {@code quickActionsIsDefault} on existing {@code agent_llm_settings} records so the
 * frontend can distinguish "quick actions never customized -> inherit the Multi Platform Hub defaults"
 * from "intentionally empty". Sets {@code false} when the record already stores a non-empty quick-actions
 * list (clearly customized) and {@code true} otherwise (no/empty list -> treat as not-yet-customized ->
 * inherit defaults).
 *
 * <p>Tenant-scoped via {@link TenantIdProvider}; idempotent (only touches records that lack the field).
 * Uses the raw collection because {@code AgentLlmSettings} lives in the SaaS lib, which this OSS module
 * does not depend on. Runs after {@code seed-agent-llm-settings} (order 006) so seeded records are
 * covered too.
 */
@Slf4j
@ChangeUnit(id = "backfill-agent-llm-settings-quick-actions-is-default", order = "008", author = "openframe")
public class BackfillAgentLlmSettingsQuickActionsIsDefaultChangeUnit {

    private static final String COLLECTION = "agent_llm_settings";
    private static final String FIELD = "quickActionsIsDefault";
    private static final String TENANT_ID = "tenantId";
    private static final String QUICK_ACTIONS = "$quickActions";

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();
        Document filter = new Document(TENANT_ID, tenantId)
                .append(FIELD, new Document("$exists", false));
        // isDefault = (no quick actions). Empty/missing list -> true (never customized, inherit MPH
        // defaults); a non-empty list -> false (the tenant configured their own).
        List<Document> pipeline = List.of(new Document("$set", new Document(FIELD,
                new Document("$eq", List.of(
                        new Document("$size", new Document("$ifNull", List.of(QUICK_ACTIONS, List.of()))),
                        0)))));
        UpdateResult result = mongoTemplate.getCollection(COLLECTION).updateMany(filter, pipeline);
        log.info("Backfilled {} on {} agent_llm_settings document(s) for tenant {}",
                FIELD, result.getModifiedCount(), tenantId);
    }

    @RollbackExecution
    public void rollback() {
    }
}
