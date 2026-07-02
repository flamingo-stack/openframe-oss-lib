package com.openframe.management.migration;

import com.mongodb.ErrorCategory;
import com.mongodb.MongoWriteException;
import com.mongodb.client.MongoCollection;
import com.openframe.data.service.TenantIdProvider;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.Instant;
import java.util.Date;
import java.util.List;

/**
 * Backfills the per-agent AI settings ({@code agent_llm_settings}, one record per agent type) for the
 * current tenant from the tenant's active model config ({@code ai_model_configs}, {@code isActive=true})
 * when a record is missing, so {@code adminAiConfig}/{@code clientAiConfig} stop returning null and the
 * settings UI shows the model the chat already uses.
 *
 * <p>Idempotent — only creates missing records, never overwrites an existing one. Tenant-scoped via
 * {@link TenantIdProvider}. Tenants without an active model config are skipped (nothing to seed from).
 *
 * <p>Uses the raw collections rather than the typed documents on purpose: {@code AgentLlmSettings} /
 * {@code AIModelConfig} live in the SaaS lib, which this OSS module does not depend on. {@code createdAt}
 * is stamped explicitly because a raw insert does not trigger Spring Data's {@code @CreatedDate} auditing
 * and the field is required downstream.
 */
@Slf4j
@ChangeUnit(id = "seed-agent-llm-settings", order = "006", author = "openframe")
public class SeedAgentLlmSettingsChangeUnit {

    private static final String AGENT_LLM_SETTINGS = "agent_llm_settings";
    private static final String AI_MODEL_CONFIGS = "ai_model_configs";
    private static final String TENANT_ID = "tenantId";
    // The concrete AIProviderConfig subtypes (e.g. AnthropicConfig) shadow the parent's
    // @Field("providerConfigType") with their own `type` field (no @Field), so Spring Data actually
    // persists the provider discriminator as "type" — verified against a real ai_model_configs document.
    private static final String PROVIDER_TYPE_FIELD = "type";
    private static final List<String> AGENT_TYPES = List.of("CLIENT", "ADMIN");
    private static final String CLASS_FIELD = "_class";
    private static final String AGENT_LLM_SETTINGS_CLASS = "com.openframe.data.document.ai.AgentLlmSettings";

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();

        Document activeConfig = mongoTemplate.getCollection(AI_MODEL_CONFIGS)
                .find(new Document(TENANT_ID, tenantId).append("isActive", true))
                .first();
        if (activeConfig == null) {
            log.info("seed-agent-llm-settings: no active model config for tenant {}, nothing to seed", tenantId);
            return;
        }

        String model = activeConfig.getString("modelName");
        Document providerConfig = activeConfig.get("providerConfig", Document.class);
        String provider = providerConfig != null ? providerConfig.getString(PROVIDER_TYPE_FIELD) : null;
        if (provider == null || model == null || model.isBlank()) {
            log.warn("seed-agent-llm-settings: active model config for tenant {} has no provider/model, skipping", tenantId);
            return;
        }

        MongoCollection<Document> settings = mongoTemplate.getCollection(AGENT_LLM_SETTINGS);
        int seeded = 0;
        for (String agentType : AGENT_TYPES) {
            Document scope = new Document(TENANT_ID, tenantId).append("agentType", agentType);
            if (settings.countDocuments(scope) > 0) {
                continue;
            }
            try {
                settings.insertOne(new Document(scope)
                        .append("llmProvider", provider)
                        .append("providerModel", model)
                        .append("createdAt", Date.from(Instant.now()))
                        .append(CLASS_FIELD, AGENT_LLM_SETTINGS_CLASS));
                seeded++;
            } catch (MongoWriteException e) {
                if (e.getError().getCategory() != ErrorCategory.DUPLICATE_KEY) {
                    throw e;
                }
                log.debug("seed-agent-llm-settings: {} for tenant {} created concurrently, skipping", agentType, tenantId);
            }
        }
        log.info("seed-agent-llm-settings: tenant {} -> seeded {} record(s) from {} - {}", tenantId, seeded, provider, model);
    }

    @RollbackExecution
    public void rollback() {
    }
}
