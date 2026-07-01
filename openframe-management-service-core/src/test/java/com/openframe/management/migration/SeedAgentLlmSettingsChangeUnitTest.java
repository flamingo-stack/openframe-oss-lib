package com.openframe.management.migration;

import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.openframe.data.service.TenantIdProvider;
import org.bson.BsonDocument;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatcher;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SeedAgentLlmSettingsChangeUnitTest {

    private static final String TENANT = "tenant-1";

    @Mock
    private MongoTemplate mongoTemplate;
    @Mock
    private TenantIdProvider tenantIdProvider;
    @Mock
    private MongoCollection<Document> aiModelConfigs;
    @Mock
    private MongoCollection<Document> agentLlmSettings;
    @Mock
    private FindIterable<Document> findIterable;

    private final SeedAgentLlmSettingsChangeUnit changeUnit = new SeedAgentLlmSettingsChangeUnit();

    private void activeConfigReturns(Document config) {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(mongoTemplate.getCollection("ai_model_configs")).thenReturn(aiModelConfigs);
        when(aiModelConfigs.find(any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(config);
    }

    // Mirrors how Spring Data actually persists the provider config: the concrete subtype
    // (AnthropicConfig) shadows the parent's @Field, so the discriminator is stored under "type".
    private static Document anthropicConfig() {
        return new Document("tenantId", TENANT)
                .append("isActive", true)
                .append("modelName", "claude-opus-4-8")
                .append("providerConfig", new Document("type", "ANTHROPIC"));
    }

    private static ArgumentMatcher<Bson> agentTypeIs(String agentType) {
        return bson -> bson instanceof Document && agentType.equals(((Document) bson).getString("agentType"));
    }

    @Test
    @DisplayName("both records missing -> inserts CLIENT and ADMIN from the active config")
    void seedsBothWhenMissing() {
        activeConfigReturns(anthropicConfig());
        when(mongoTemplate.getCollection("agent_llm_settings")).thenReturn(agentLlmSettings);
        when(agentLlmSettings.countDocuments(any(Bson.class))).thenReturn(0L);

        changeUnit.execution(mongoTemplate, tenantIdProvider);

        ArgumentCaptor<Document> inserted = ArgumentCaptor.forClass(Document.class);
        verify(agentLlmSettings, times(2)).insertOne(inserted.capture());
        List<Document> docs = inserted.getAllValues();
        assertThat(docs).extracting(d -> d.getString("agentType"))
                .containsExactlyInAnyOrder("CLIENT", "ADMIN");
        assertThat(docs).allSatisfy(d -> {
            assertThat(d.getString("tenantId")).isEqualTo(TENANT);
            assertThat(d.getString("llmProvider")).isEqualTo("ANTHROPIC");
            assertThat(d.getString("providerModel")).isEqualTo("claude-opus-4-8");
            assertThat(d.get("createdAt")).isInstanceOf(Date.class);
            assertThat(d.getString("_class")).isEqualTo("com.openframe.data.document.ai.AgentLlmSettings");
        });
    }

    @Test
    @DisplayName("only the missing agent type is inserted")
    void seedsOnlyMissingAgentType() {
        activeConfigReturns(anthropicConfig());
        when(mongoTemplate.getCollection("agent_llm_settings")).thenReturn(agentLlmSettings);
        when(agentLlmSettings.countDocuments(argThat(agentTypeIs("CLIENT")))).thenReturn(1L); // exists
        when(agentLlmSettings.countDocuments(argThat(agentTypeIs("ADMIN")))).thenReturn(0L);  // missing

        changeUnit.execution(mongoTemplate, tenantIdProvider);

        ArgumentCaptor<Document> inserted = ArgumentCaptor.forClass(Document.class);
        verify(agentLlmSettings, times(1)).insertOne(inserted.capture());
        assertThat(inserted.getValue().getString("agentType")).isEqualTo("ADMIN");
    }

    @Test
    @DisplayName("records already exist -> nothing inserted")
    void skipsWhenPresent() {
        activeConfigReturns(anthropicConfig());
        when(mongoTemplate.getCollection("agent_llm_settings")).thenReturn(agentLlmSettings);
        when(agentLlmSettings.countDocuments(any(Bson.class))).thenReturn(1L);

        changeUnit.execution(mongoTemplate, tenantIdProvider);

        verify(agentLlmSettings, never()).insertOne(any());
    }

    @Test
    @DisplayName("no active model config -> agent_llm_settings is not touched")
    void skipsWhenNoActiveConfig() {
        activeConfigReturns(null);

        changeUnit.execution(mongoTemplate, tenantIdProvider);

        verify(mongoTemplate, never()).getCollection("agent_llm_settings");
    }

    @Test
    @DisplayName("active config without a provider -> nothing inserted")
    void skipsWhenNoProvider() {
        activeConfigReturns(new Document("tenantId", TENANT).append("isActive", true).append("modelName", "claude-opus-4-8"));

        changeUnit.execution(mongoTemplate, tenantIdProvider);

        verify(mongoTemplate, never()).getCollection("agent_llm_settings");
    }

    @Test
    @DisplayName("active config with a blank model -> nothing inserted")
    void skipsWhenModelBlank() {
        activeConfigReturns(new Document("tenantId", TENANT)
                .append("isActive", true)
                .append("modelName", "   ")
                .append("providerConfig", new Document("type", "ANTHROPIC")));

        changeUnit.execution(mongoTemplate, tenantIdProvider);

        verify(mongoTemplate, never()).getCollection("agent_llm_settings");
    }

    @Test
    @DisplayName("concurrent duplicate-key on insert is swallowed (never fails the migration)")
    void swallowsConcurrentDuplicateKey() {
        activeConfigReturns(anthropicConfig());
        when(mongoTemplate.getCollection("agent_llm_settings")).thenReturn(agentLlmSettings);
        when(agentLlmSettings.countDocuments(any(Bson.class))).thenReturn(0L);
        doThrow(new MongoWriteException(new WriteError(11000, "dup", new BsonDocument()), new ServerAddress()))
                .when(agentLlmSettings).insertOne(any(Document.class));

        assertThatCode(() -> changeUnit.execution(mongoTemplate, tenantIdProvider)).doesNotThrowAnyException();
    }
}
