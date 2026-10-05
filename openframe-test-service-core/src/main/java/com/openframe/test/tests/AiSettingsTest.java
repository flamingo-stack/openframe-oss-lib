package com.openframe.test.tests;

import com.openframe.test.api.AiSettingsApi;
import com.openframe.test.api.OrganizationApi;
import com.openframe.test.context.PipelineContext;
import com.openframe.test.data.dto.aisettings.AgentAiConfig;
import com.openframe.test.data.dto.aisettings.AgentAiConfigInput;
import com.openframe.test.data.dto.aisettings.AgentAiConfigPayload;
import com.openframe.test.data.dto.aisettings.AiConfiguration;
import com.openframe.test.data.dto.aisettings.AiConfigurationRequest;
import com.openframe.test.data.dto.aisettings.AiConfigurationTestResult;
import com.openframe.test.data.dto.aisettings.AiPolicySummary;
import com.openframe.test.data.dto.aisettings.ClientView;
import com.openframe.test.data.dto.aisettings.ClientViewInput;
import com.openframe.test.data.dto.aisettings.ClientViewPayload;
import com.openframe.test.data.dto.aisettings.GuardrailOverride;
import com.openframe.test.data.dto.aisettings.GuardrailRule;
import com.openframe.test.data.dto.aisettings.OrganizationClientAiConfig;
import com.openframe.test.data.dto.aisettings.OrganizationClientAiConfigPayload;
import com.openframe.test.data.dto.aisettings.OrganizationGuardrails;
import com.openframe.test.data.dto.aisettings.OrganizationGuardrailsInput;
import com.openframe.test.data.dto.aisettings.OrganizationGuardrailsPayload;
import com.openframe.test.data.dto.aisettings.QuickAction;
import com.openframe.test.data.dto.aisettings.QuickActionInput;
import com.openframe.test.data.dto.aisettings.SupportedModel;
import com.openframe.test.data.dto.organization.Organization;
import com.openframe.test.data.dto.shared.MutationError;
import com.openframe.test.data.generator.OrganizationGenerator;
import com.openframe.test.helpers.ai.RunId;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Assistant AI settings over {@code chat/graphql} (coverage plan item CP-8): the two tenant-wide AI
 * logic configs are read and written back unchanged, asserting the echo (the owner's decision of
 * 2026-09-13: the mutations run everywhere, behaviour-neutral by construction), and the client
 * assistant view is overridden and reset on a throwaway organization. The same organization then
 * takes its own client AI config and guardrails and resets them (CP-30), and the REST AI
 * configuration is read and connection-tested with a fake key (CP-39); saving it runs only on a
 * pipeline-registered tenant.
 */
@Tag("saas")
@Tag("ai-settings")
@DisplayName("AI settings")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class AiSettingsTest extends BaseTest {

    private static final RunId RUN_ID = RunId.next();
    private static final Set<String> PROVIDERS = Set.of("ANTHROPIC", "OPENAI", "GOOGLE_GEMINI");
    private static final Set<String> ANSWER_STYLES = Set.of("SHORT", "STANDARD", "DETAILED", "CUSTOM");
    private static final Set<String> APPROVAL_LEVELS = Set.of("ALLOW", "ASK_USER", "ASK_TECHNICIAN", "DENY");
    // A well-formed ObjectId that names no policy
    private static final String UNKNOWN_TEMPLATE_ID = "000000000000000000000000";

    private static Organization organization;
    private static OrganizationClientAiConfig inheritedAiConfig;
    private static OrganizationClientAiConfig overrideAiConfig;
    private static OrganizationGuardrails inheritedGuardrails;
    private static String templateId;
    private static OrganizationGuardrails customGuardrails;
    private static AiConfiguration aiConfiguration;

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Read the admin and client AI configs")
    @Order(1)
    public void testReadConfigs() {
        AgentAiConfig admin = AiSettingsApi.getAdminAiConfig();
        AgentAiConfig client = AiSettingsApi.getClientAiConfig();
        for (AgentAiConfig config : List.of(admin, client)) {
            assertThat(config).as("Each assistant has a config, persisted or synthetic").isNotNull();
            assertThat(config.getAgentType()).as("agentType is set").isNotBlank();
            assertThat(config.getLlmProvider()).as("llmProvider is a schema value").isIn(PROVIDERS);
            assertThat(config.getProviderModel()).as("providerModel is set").isNotBlank();
            if (config.getAnswerStyle() != null) {
                assertThat(config.getAnswerStyle()).as("answerStyle is a schema value").isIn(ANSWER_STYLES);
            }
            if (config.getId() == null) {
                assertThat(config.getCreatedAt()).as("A synthetic default (id null) is not persisted").isNull();
            }
        }
        assertThat(admin.getAgentType()).as("The two configs belong to different assistants").isNotEqualTo(client.getAgentType());
        AiSettingsApi.getClientView(null); // the tenant default may or may not exist; it must resolve without error
    }

    @Tag("feature")
    @Test
    @DisplayName("Write the admin AI config back unchanged")
    @Order(2)
    public void testAdminConfigWriteBack() {
        writeBack("admin", AiSettingsApi::getAdminAiConfig, AiSettingsApi::updateAdminAiConfig);
    }

    @Tag("feature")
    @Test
    @DisplayName("Write the client AI config back unchanged")
    @Order(3)
    public void testClientConfigWriteBack() {
        writeBack("client", AiSettingsApi::getClientAiConfig, AiSettingsApi::updateClientAiConfig);
    }

    @Tag("feature")
    @Test
    @DisplayName("Override and reset a customer's assistant view")
    @Order(4)
    public void testOverrideAndResetClientView() {
        organization = OrganizationApi.createOrganization(OrganizationGenerator.createOrganizationRequest(true));
        String orgId = organization.getOrganizationId();
        assertThat(orgId).as("The throwaway organization has an organizationId").isNotBlank();
        assertThat(AiSettingsApi.getClientView(orgId)).as("A new organization has no view override").isNull();

        ClientViewInput input = ClientViewInput.builder()
                .assistantName("E2E-" + RUN_ID + " assistant").applicationTheme("DARK").accentColor("#FF00AA").build();
        ClientViewPayload updated = AiSettingsApi.updateClientView(orgId, input);
        assertThat(updated.getUserErrors()).as("Creating the override reports no userErrors").isEmpty();
        ClientView view = updated.getView();
        assertThat(view).as("The override is returned").isNotNull();
        assertThat(view.getOrganizationId()).as("The override belongs to the organization").isEqualTo(orgId);
        assertThat(view.getAssistantName()).as("assistantName is stored").isEqualTo(input.getAssistantName());
        assertThat(view.getApplicationTheme()).as("applicationTheme is stored").isEqualTo("DARK");
        assertThat(view.getAccentColor()).as("accentColor is stored").isEqualTo("#FF00AA");

        ClientView fetched = AiSettingsApi.getClientView(orgId);
        assertThat(fetched).as("clientView(organizationId) returns the override").isNotNull();
        assertThat(fetched.getId()).as("It is the same view").isEqualTo(view.getId());

        ClientViewPayload updatedAgain = AiSettingsApi.updateClientView(orgId,
                ClientViewInput.builder().applicationTheme("LIGHT").build());
        assertThat(updatedAgain.getUserErrors()).as("Updating the override reports no userErrors").isEmpty();
        assertThat(updatedAgain.getView().getApplicationTheme()).as("A partial update changes only the theme").isEqualTo("LIGHT");
        assertThat(updatedAgain.getView().getAssistantName()).as("Untouched fields survive a partial update").isEqualTo(input.getAssistantName());

        ClientViewPayload reset = AiSettingsApi.resetClientView(orgId);
        assertThat(reset.getUserErrors()).as("Resetting reports no userErrors").isEmpty();
        if (reset.getView() != null) {
            assertThat(reset.getView().getOrganizationId()).as("After a reset the tenant default (no organization) comes back").isNull();
        }
        assertThat(AiSettingsApi.getClientView(orgId)).as("The override is gone").isNull();
        ClientViewPayload resetAgain = AiSettingsApi.resetClientView(orgId);
        assertThat(resetAgain.getUserErrors()).as("Resetting again is harmless").isEmpty();
    }

    @Tag("feature")
    @Test
    @DisplayName("Read a customer's inherited client AI config")
    @Order(5)
    public void testReadInheritedOrganizationAiConfig() {
        requireOrganization();
        String orgId = organization.getOrganizationId();
        AgentAiConfig tenant = AiSettingsApi.getClientAiConfig();
        OrganizationClientAiConfig config = AiSettingsApi.getOrganizationClientAiConfig(orgId);
        assertThat(config.getOrganizationId()).as("The view belongs to the organization").isEqualTo(orgId);
        assertThat(config.getInheritDefault()).as("A new organization inherits the tenant default").isTrue();
        assertThat(config.getQuickActionsIsDefault()).as("It follows the tenant's quick actions").isTrue();
        assertThat(config.getUpdatedAt()).as("No override, so no override timestamp").isNull();
        assertThat(config.getLlmProvider()).as("The tenant's provider shows through").isEqualTo(tenant.getLlmProvider());
        assertThat(config.getProviderModel()).as("The tenant's model shows through").isEqualTo(tenant.getProviderModel());
        assertThat(config.getAnswerStyle()).as("The tenant's answer style shows through").isEqualTo(tenant.getAnswerStyle());
        assertThat(config.getCustomPrompt()).as("The tenant's custom prompt shows through").isEqualTo(tenant.getCustomPrompt());
        assertThat(actions(config.getQuickActions())).as("The tenant's own quick actions show through, none while it keeps the built-in defaults")
                .containsExactlyElementsOf(tenantOwnActions(tenant));
        inheritedAiConfig = config;
    }

    @Tag("feature")
    @Test
    @DisplayName("Override a customer's client AI config")
    @Order(6)
    public void testOverrideOrganizationAiConfig() {
        requireInheritedAiConfig();
        String orgId = organization.getOrganizationId();
        OrganizationClientAiConfigPayload refused = AiSettingsApi.updateOrganizationClientAiConfig(orgId, AgentAiConfigInput.builder()
                .llmProvider(inheritedAiConfig.getLlmProvider()).providerModel("e2e-unsupported-" + RUN_ID).build());
        assertThat(refused.getConfig()).as("A model outside the supported list is refused").isNull();
        assertThat(refused.getUserErrors()).as("The refusal is a userError naming the model")
                .extracting(MutationError::getMessage).anyMatch(m -> m.contains("not supported"));
        assertThat(AiSettingsApi.getOrganizationClientAiConfig(orgId).getInheritDefault()).as("A refused update stores nothing").isTrue();

        // A listed model of the tenant's provider, another one than the tenant's when the list has one
        SupportedModel model = AiSettingsApi.supportedModels().values().stream().flatMap(List::stream)
                .filter(m -> m.getProvider().equals(inheritedAiConfig.getLlmProvider()))
                .min(Comparator.comparing(m -> m.getModelName().equals(inheritedAiConfig.getProviderModel())))
                .orElseThrow(() -> new AssertionError("The environment offers no model of the tenant's provider " + inheritedAiConfig.getLlmProvider()));
        String answerStyle = "DETAILED".equals(inheritedAiConfig.getAnswerStyle()) ? "SHORT" : "DETAILED";
        AgentAiConfigInput input = AgentAiConfigInput.builder()
                .llmProvider(model.getProvider()).providerModel(model.getModelName()).answerStyle(answerStyle)
                .customPrompt("E2E-" + RUN_ID + " prompt")
                .quickActions(List.of(QuickActionInput.builder().name("E2E-" + RUN_ID + " action").instructions("Summarize the device health").build()))
                .build();
        OrganizationClientAiConfigPayload created = AiSettingsApi.updateOrganizationClientAiConfig(orgId, input);
        assertThat(created.getUserErrors()).as("Creating the override reports no userErrors").isEmpty();
        OrganizationClientAiConfig config = created.getConfig();
        assertThat(config.getInheritDefault()).as("The organization now has its own config").isFalse();
        assertThat(config.getLlmProvider()).as("llmProvider is stored").isEqualTo(model.getProvider());
        assertThat(config.getProviderModel()).as("providerModel is stored").isEqualTo(model.getModelName());
        assertThat(config.getAnswerStyle()).as("answerStyle is stored").isEqualTo(answerStyle);
        assertThat(config.getCustomPrompt()).as("customPrompt is stored").isEqualTo(input.getCustomPrompt());
        assertThat(actions(config.getQuickActions())).as("The organization keeps its own quick actions")
                .containsExactly(input.getQuickActions().getFirst().getName() + "|" + input.getQuickActions().getFirst().getInstructions());
        assertThat(config.getQuickActions().getFirst().getId()).as("The server mints the quick action id").isNotBlank();
        assertThat(config.getQuickActionsIsDefault()).as("Its own list unticks \"use default quick actions\"").isFalse();
        assertThat(config.getUpdatedAt()).as("The override is timestamped").isNotNull();

        OrganizationClientAiConfigPayload partial = AiSettingsApi.updateOrganizationClientAiConfig(orgId,
                AgentAiConfigInput.builder().customPrompt("E2E-" + RUN_ID + " prompt v2").build());
        assertThat(partial.getUserErrors()).as("A partial update reports no userErrors").isEmpty();
        assertThat(partial.getConfig().getCustomPrompt()).as("A partial update changes only the prompt").isEqualTo("E2E-" + RUN_ID + " prompt v2");
        assertThat(partial.getConfig().getAnswerStyle()).as("Untouched fields survive a partial update").isEqualTo(answerStyle);
        assertThat(partial.getConfig().getQuickActions().getFirst().getId()).as("The quick action survives a partial update")
                .isEqualTo(config.getQuickActions().getFirst().getId());

        OrganizationClientAiConfig fetched = AiSettingsApi.getOrganizationClientAiConfig(orgId);
        assertThat(fetched.getInheritDefault()).as("organizationClientAiConfig returns the override").isFalse();
        assertThat(fetched.getCustomPrompt()).as("It is the updated override").isEqualTo("E2E-" + RUN_ID + " prompt v2");
        overrideAiConfig = fetched;
    }

    @Tag("feature")
    @Test
    @DisplayName("Reset only a customer's quick actions")
    @Order(7)
    public void testResetOrganizationQuickActions() {
        requireAiOverride();
        String orgId = organization.getOrganizationId();
        OrganizationClientAiConfigPayload payload = AiSettingsApi.resetOrganizationClientAiQuickActions(orgId);
        assertThat(payload.getUserErrors()).as("Resetting the quick actions reports no userErrors").isEmpty();
        OrganizationClientAiConfig config = payload.getConfig();
        assertThat(config.getQuickActionsIsDefault()).as("The organization follows the tenant's quick actions again").isTrue();
        assertThat(actions(config.getQuickActions())).as("The tenant's quick actions show through")
                .containsExactlyElementsOf(actions(inheritedAiConfig.getQuickActions()));
        assertThat(config.getInheritDefault()).as("The rest of the override survives").isFalse();
        assertThat(config.getLlmProvider()).as("llmProvider survives").isEqualTo(overrideAiConfig.getLlmProvider());
        assertThat(config.getProviderModel()).as("providerModel survives").isEqualTo(overrideAiConfig.getProviderModel());
        assertThat(config.getAnswerStyle()).as("answerStyle survives").isEqualTo(overrideAiConfig.getAnswerStyle());
        assertThat(config.getCustomPrompt()).as("customPrompt survives").isEqualTo(overrideAiConfig.getCustomPrompt());
        assertThat(AiSettingsApi.getOrganizationClientAiConfig(orgId).getQuickActionsIsDefault()).as("The reset is stored").isTrue();
    }

    @Tag("feature")
    @Test
    @DisplayName("Reset a customer's client AI config to the tenant default")
    @Order(8)
    public void testResetOrganizationAiConfig() {
        requireAiOverride();
        String orgId = organization.getOrganizationId();
        OrganizationClientAiConfigPayload payload = AiSettingsApi.resetOrganizationClientAiConfig(orgId);
        assertThat(payload.getUserErrors()).as("Resetting reports no userErrors").isEmpty();
        OrganizationClientAiConfig config = payload.getConfig();
        assertThat(config.getInheritDefault()).as("The organization inherits the tenant default again").isTrue();
        assertThat(config.getUpdatedAt()).as("No override, so no override timestamp").isNull();
        assertThat(config.getLlmProvider()).as("The tenant's provider is back").isEqualTo(inheritedAiConfig.getLlmProvider());
        assertThat(config.getProviderModel()).as("The tenant's model is back").isEqualTo(inheritedAiConfig.getProviderModel());
        assertThat(config.getAnswerStyle()).as("The tenant's answer style is back").isEqualTo(inheritedAiConfig.getAnswerStyle());
        assertThat(config.getCustomPrompt()).as("The tenant's custom prompt is back").isEqualTo(inheritedAiConfig.getCustomPrompt());
        assertThat(AiSettingsApi.getOrganizationClientAiConfig(orgId).getInheritDefault()).as("The reset is stored").isTrue();
        OrganizationClientAiConfigPayload again = AiSettingsApi.resetOrganizationClientAiConfig(orgId);
        assertThat(again.getUserErrors()).as("Resetting again is harmless").isEmpty();
        assertThat(again.getConfig().getInheritDefault()).as("It still inherits").isTrue();
    }

    @Tag("feature")
    @Test
    @DisplayName("Read a customer's inherited guardrails")
    @Order(9)
    public void testReadInheritedGuardrails() {
        requireOrganization();
        String orgId = organization.getOrganizationId();
        OrganizationGuardrails guardrails = AiSettingsApi.getOrganizationGuardrails(orgId);
        assertThat(guardrails.getOrganizationId()).as("The view belongs to the organization").isEqualTo(orgId);
        assertThat(guardrails.getInheritDefault()).as("A new organization inherits the tenant guardrails").isTrue();
        assertThat(guardrails.getActive()).as("It has no policy of its own").isFalse();
        assertThat(guardrails.getSourceTemplate()).as("Never customized, so no source template").isNull();
        assertThat(guardrails.getOverrides()).as("Never customized, so no overrides").isEmpty();
        assertThat(guardrails.getRules()).as("The tenant rules show through, each keyed and levelled")
                .isNotEmpty().allSatisfy(r -> {
                    assertThat(r.getNaturalKey()).as("naturalKey").isNotBlank();
                    assertThat(r.getApprovalLevel()).as("approvalLevel").isIn(APPROVAL_LEVELS);
                });
        inheritedGuardrails = guardrails;
    }

    @Tag("feature")
    @Test
    @DisplayName("Customize a customer's guardrails from a template")
    @Order(10)
    public void testCustomizeGuardrails() {
        requireInheritedGuardrails();
        String orgId = organization.getOrganizationId();
        OrganizationGuardrailsPayload refused = AiSettingsApi.updateOrganizationGuardrails(orgId,
                OrganizationGuardrailsInput.builder().templateId(UNKNOWN_TEMPLATE_ID).build());
        assertThat(refused.getGuardrails()).as("An unknown template is refused").isNull();
        assertThat(refused.getUserErrors()).as("The refusal is a userError naming the template")
                .extracting(MutationError::getMessage).anyMatch(m -> m.contains("Template not found"));
        assertThat(AiSettingsApi.getOrganizationGuardrails(orgId).getInheritDefault()).as("A refused update stores nothing").isTrue();

        List<AiPolicySummary> templates = AiSettingsApi.getAiPolicies().stream().filter(p -> "TEMPLATE".equals(p.getType())).toList();
        assertThat(templates).as("The tenant offers guardrail templates").isNotEmpty();
        AiPolicySummary template = templates.stream().filter(p -> Boolean.TRUE.equals(p.getIsActive())).findFirst().orElse(templates.getFirst());
        OrganizationGuardrailsPayload payload = AiSettingsApi.updateOrganizationGuardrails(orgId,
                OrganizationGuardrailsInput.builder().templateId(template.getId()).build());
        assertThat(payload.getUserErrors()).as("Customizing from a template reports no userErrors").isEmpty();
        OrganizationGuardrails guardrails = payload.getGuardrails();
        assertThat(guardrails.getInheritDefault()).as("The organization now owns its guardrails").isFalse();
        assertThat(guardrails.getActive()).as("Its policy is active").isTrue();
        assertThat(guardrails.getSourceTemplate()).as("The policy remembers its template").isEqualTo(template.getId());
        assertThat(guardrails.getOverrides()).as("No overrides were sent").isEmpty();
        assertThat(guardrails.getRules()).as("The template's rules are materialized").isNotEmpty();
        if (Boolean.TRUE.equals(template.getIsActive())) {
            assertThat(levels(guardrails.getRules())).as("The tenant's own active template materializes the rules the tenant enforces")
                    .containsExactlyInAnyOrderElementsOf(levels(inheritedGuardrails.getRules()));
        }
        assertThat(AiSettingsApi.getOrganizationGuardrails(orgId).getInheritDefault()).as("The custom policy is stored").isFalse();
        templateId = template.getId();
        customGuardrails = guardrails;
    }

    @Tag("feature")
    @Test
    @DisplayName("Override one guardrail operation's approval level")
    @Order(11)
    public void testOverrideGuardrailRule() {
        requireCustomGuardrails();
        String orgId = organization.getOrganizationId();
        GuardrailRule rule = customGuardrails.getRules().getFirst();
        String level = "DENY".equals(rule.getApprovalLevel()) ? "ASK_TECHNICIAN" : "DENY";
        GuardrailOverride override = GuardrailOverride.builder().naturalKey(rule.getNaturalKey()).approvalLevel(level).build();
        OrganizationGuardrailsPayload payload = AiSettingsApi.updateOrganizationGuardrails(orgId,
                OrganizationGuardrailsInput.builder().templateId(templateId).overrides(List.of(override)).build());
        assertThat(payload.getUserErrors()).as("Overriding a rule reports no userErrors").isEmpty();
        OrganizationGuardrails guardrails = payload.getGuardrails();
        assertThat(guardrails.getOverrides()).as("The override is listed by naturalKey")
                .extracting(o -> o.getNaturalKey() + "=" + o.getApprovalLevel()).containsExactly(rule.getNaturalKey() + "=" + level);
        assertThat(guardrails.getRules()).as("The overridden operation carries the new level")
                .filteredOn(r -> r.getNaturalKey().equals(rule.getNaturalKey()))
                .isNotEmpty().extracting(GuardrailRule::getApprovalLevel).containsOnly(level);
        assertThat(levels(guardrails.getRules().stream().filter(r -> !r.getNaturalKey().equals(rule.getNaturalKey())).toList()))
                .as("Every other operation keeps the template's level")
                .containsExactlyElementsOf(levels(customGuardrails.getRules().stream().filter(r -> !r.getNaturalKey().equals(rule.getNaturalKey())).toList()));
        assertThat(guardrails.getSourceTemplate()).as("The template is unchanged").isEqualTo(templateId);
        assertThat(AiSettingsApi.getOrganizationGuardrails(orgId).getOverrides()).as("The override is stored")
                .extracting(GuardrailOverride::getNaturalKey).containsExactly(rule.getNaturalKey());
    }

    @Tag("feature")
    @Test
    @DisplayName("Reset a customer's guardrails to the tenant default")
    @Order(12)
    public void testResetGuardrails() {
        requireCustomGuardrails();
        String orgId = organization.getOrganizationId();
        OrganizationGuardrailsPayload payload = AiSettingsApi.resetOrganizationGuardrails(orgId);
        assertThat(payload.getUserErrors()).as("Resetting reports no userErrors").isEmpty();
        OrganizationGuardrails guardrails = payload.getGuardrails();
        assertThat(guardrails.getInheritDefault()).as("The organization inherits the tenant guardrails again").isTrue();
        assertThat(levels(guardrails.getRules())).as("The tenant rules show through again")
                .containsExactlyInAnyOrderElementsOf(levels(inheritedGuardrails.getRules()));
        assertThat(AiSettingsApi.getOrganizationGuardrails(orgId).getInheritDefault()).as("The reset is stored").isTrue();
    }

    @Tag("feature")
    @Test
    @DisplayName("Read the AI configuration and its supported models")
    @Order(13)
    public void testReadAiConfiguration() {
        AiConfiguration config = AiSettingsApi.getAiConfiguration();
        assertThat(config.getProvider()).as("provider is a schema value").isIn(PROVIDERS);
        assertThat(config.getModelName()).as("modelName is set").isNotBlank();
        assertThat(config.getIsActive()).as("The configuration in effect is the active one").isTrue();
        assertThat(config.getHasApiKey()).as("hasApiKey is reported").isNotNull();

        Map<String, List<SupportedModel>> models = AiSettingsApi.supportedModels();
        List<SupportedModel> all = models.values().stream().flatMap(List::stream).toList();
        assertThat(all).as("The environment offers models").isNotEmpty().allSatisfy(m -> {
            assertThat(m.getProvider()).as("provider").isIn(PROVIDERS);
            assertThat(m.getModelName()).as("modelName").isNotBlank();
        });
        assertThat(all).as("The active model is one the environment offers (an unlisted stored model is reported as the provider default)")
                .anyMatch(m -> m.getProvider().equals(config.getProvider()) && m.getModelName().equals(config.getModelName()));

        AgentAiConfig client = AiSettingsApi.getClientAiConfig();
        if (client.getId() == null) {
            assertThat(client.getLlmProvider() + " " + client.getProviderModel()).as("The synthetic client config is built from this configuration")
                    .isEqualTo(config.getProvider() + " " + config.getModelName());
        }
        aiConfiguration = config;
    }

    @Tag("feature")
    @Test
    @DisplayName("Test a connection with a fake API key")
    @Order(14)
    public void testAiConfigurationWithFakeKey() {
        requireAiConfiguration();
        String fakeKey = "sk-" + RUN_ID + "-not-a-real-key";
        AiConfigurationRequest request = AiConfigurationRequest.builder()
                .provider(aiConfiguration.getProvider()).modelName(aiConfiguration.getModelName()).apiKey(fakeKey).build();
        AiConfigurationTestResult result = AiSettingsApi.testAiConfiguration(request);
        assertThat(result.getSuccess()).as("The provider rejects a fake key").isFalse();
        assertThat(result.getMessage()).as("The failure is explained").startsWith("Connection failed");
        assertThat(result.getProvider()).as("The result names the provider tested").isEqualTo(aiConfiguration.getProvider());
        assertThat(result.getModel()).as("The result names the model tested").isEqualTo(aiConfiguration.getModelName());
        assertThat(result.getTestResponse()).as("No model answer on failure").isNull();

        int missingModel = AiSettingsApi.testAiConfigurationRaw(AiConfigurationRequest.builder()
                .provider(aiConfiguration.getProvider()).apiKey(fakeKey).build()).statusCode();
        assertThat(missingModel).as("A request without a model is invalid").isEqualTo(400);

        AiConfiguration after = AiSettingsApi.getAiConfiguration();
        assertThat(after.getId()).as("Testing saves nothing: same configuration").isEqualTo(aiConfiguration.getId());
        assertThat(after.getModelName()).as("Testing saves nothing: same model").isEqualTo(aiConfiguration.getModelName());
        assertThat(after.getHasApiKey()).as("Testing saves nothing: the key is untouched").isEqualTo(aiConfiguration.getHasApiKey());
    }

    @Tag("feature")
    @Tag("needs-registered-tenant")
    @Test
    @DisplayName("Save the AI configuration back unchanged")
    @Order(15)
    public void testSaveAiConfiguration() {
        assumeTrue(PipelineContext.hasRegisteredTenant(), "Saving reloads the assistants tenant-wide; only a pipeline-registered tenant is the run's own");
        requireAiConfiguration();
        AiConfiguration before = AiSettingsApi.getAiConfiguration();
        assumeTrue(!Boolean.TRUE.equals(before.getHasApiKey()), "A stored tenant key cannot be read back, so only a platform-key configuration can be written back unchanged");
        AiConfiguration saved = AiSettingsApi.saveAiConfiguration(AiConfigurationRequest.builder()
                .provider(before.getProvider()).modelName(before.getModelName()).build());
        assertThat(saved.getId()).as("Saving stores a configuration").isNotBlank();
        assertThat(saved.getProvider()).as("provider is stored").isEqualTo(before.getProvider());
        assertThat(saved.getModelName()).as("modelName is stored").isEqualTo(before.getModelName());
        assertThat(saved.getIsActive()).as("The saved configuration is the active one").isTrue();
        assertThat(saved.getHasApiKey()).as("No key sent, so the platform key stays in use").isFalse();
        AiConfiguration after = AiSettingsApi.getAiConfiguration();
        assertThat(after.getId()).as("The saved configuration is the one in effect").isEqualTo(saved.getId());
        assertThat(after.getModelName()).as("The model in effect is unchanged").isEqualTo(before.getModelName());
    }

    private static void writeBack(String which, Supplier<AgentAiConfig> read, Function<AgentAiConfigInput, AgentAiConfigPayload> update) {
        AgentAiConfig before = read.get();
        AgentAiConfigInput echo = AgentAiConfigInput.echoOf(before);
        AgentAiConfigPayload payload = update.apply(echo);
        assertThat(payload.getUserErrors()).as("Writing the " + which + " config back reports no userErrors").isEmpty();
        AgentAiConfig written = payload.getAiConfig();
        assertThat(written).as("The mutation returns the config").isNotNull();
        assertSameConfig(which + " config returned by the mutation", before, written);
        assertThat(written.getId()).as("A written config is persisted (id set)").isNotNull();
        assertSameConfig(which + " config re-read", before, read.get());
    }

    private static void assertSameConfig(String what, AgentAiConfig expected, AgentAiConfig actual) {
        assertThat(actual.getAgentType()).as(what + ": agentType").isEqualTo(expected.getAgentType());
        assertThat(actual.getLlmProvider()).as(what + ": llmProvider").isEqualTo(expected.getLlmProvider());
        assertThat(actual.getProviderModel()).as(what + ": providerModel").isEqualTo(expected.getProviderModel());
        assertThat(actual.getAnswerStyle()).as(what + ": answerStyle").isEqualTo(expected.getAnswerStyle());
        assertThat(actual.getCustomPrompt()).as(what + ": customPrompt").isEqualTo(expected.getCustomPrompt());
        if (expected.getQuickActionsIsDefault() != null) {
            assertThat(actual.getQuickActionsIsDefault()).as(what + ": quickActionsIsDefault").isEqualTo(expected.getQuickActionsIsDefault());
        }
        List<String> expectedActions = expected.getQuickActions() == null ? List.of()
                : expected.getQuickActions().stream().map(q -> q.getName() + "|" + q.getInstructions()).toList();
        List<String> actualActions = actual.getQuickActions() == null ? List.of()
                : actual.getQuickActions().stream().map(q -> q.getName() + "|" + q.getInstructions()).toList();
        assertThat(actualActions).as(what + ": quick actions").containsExactlyElementsOf(expectedActions);
        if (expected.getQuickActions() != null && actual.getQuickActions() != null) {
            assertThat(actual.getQuickActions().stream().map(QuickAction::getId).toList())
                    .as(what + ": quick action ids survive the echo")
                    .containsExactlyElementsOf(expected.getQuickActions().stream().map(QuickAction::getId).toList());
        }
    }

    @AfterAll
    public static void cleanup() {
        if (organization == null) {
            return;
        }
        String orgId = organization.getOrganizationId();
        AiSettingsApi.resetClientViewRaw(orgId);
        if (overrideAiConfig != null) {
            AiSettingsApi.resetOrganizationClientAiConfigRaw(orgId);
        }
        if (customGuardrails != null) {
            AiSettingsApi.resetOrganizationGuardrailsRaw(orgId);
        }
        OrganizationApi.archiveOrganizationRaw(orgId);
    }

    private static void requireOrganization() {
        assumeTrue(organization != null, "No organization was created in \"Override and reset a customer's assistant view\"; see that failure");
    }

    private static void requireInheritedAiConfig() {
        requireOrganization();
        assumeTrue(inheritedAiConfig != null, "The inherited client AI config was not read; see \"Read a customer's inherited client AI config\"");
    }

    private static void requireAiOverride() {
        requireInheritedAiConfig();
        assumeTrue(overrideAiConfig != null, "No override was created; see \"Override a customer's client AI config\"");
    }

    private static void requireInheritedGuardrails() {
        requireOrganization();
        assumeTrue(inheritedGuardrails != null, "The inherited guardrails were not read; see \"Read a customer's inherited guardrails\"");
    }

    private static void requireCustomGuardrails() {
        requireInheritedGuardrails();
        assumeTrue(customGuardrails != null, "No custom guardrails were created; see \"Customize a customer's guardrails from a template\"");
    }

    private static void requireAiConfiguration() {
        assumeTrue(aiConfiguration != null, "The AI configuration was not read; see \"Read the AI configuration and its supported models\"");
    }

    private static List<String> actions(List<QuickAction> quickActions) {
        return quickActions == null ? List.of() : quickActions.stream().map(q -> q.getName() + "|" + q.getInstructions()).toList();
    }

    // The tenant's own quick action list, empty while it keeps the built-in defaults (a legacy config without the flag counts its list)
    private static List<String> tenantOwnActions(AgentAiConfig tenant) {
        boolean onDefaults = tenant.getQuickActionsIsDefault() != null ? tenant.getQuickActionsIsDefault() : tenant.getQuickActions() == null;
        return onDefaults ? List.of() : actions(tenant.getQuickActions());
    }

    private static List<String> levels(List<GuardrailRule> rules) {
        return rules.stream().map(r -> r.getNaturalKey() + "=" + r.getApprovalLevel()).toList();
    }
}
