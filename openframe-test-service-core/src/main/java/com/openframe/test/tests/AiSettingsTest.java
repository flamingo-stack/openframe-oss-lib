package com.openframe.test.tests;

import com.openframe.test.api.AiSettingsApi;
import com.openframe.test.api.OrganizationApi;
import com.openframe.test.data.dto.aisettings.AgentAiConfig;
import com.openframe.test.data.dto.aisettings.AgentAiConfigInput;
import com.openframe.test.data.dto.aisettings.AgentAiConfigPayload;
import com.openframe.test.data.dto.aisettings.ClientView;
import com.openframe.test.data.dto.aisettings.ClientViewInput;
import com.openframe.test.data.dto.aisettings.ClientViewPayload;
import com.openframe.test.data.dto.aisettings.QuickAction;
import com.openframe.test.data.dto.organization.Organization;
import com.openframe.test.data.generator.OrganizationGenerator;
import com.openframe.test.helpers.ai.RunId;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.util.List;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Assistant AI settings over {@code chat/graphql} (coverage plan item CP-8): the two tenant-wide AI
 * logic configs are read and written back unchanged, asserting the echo (the owner's decision of
 * 2026-09-13: the mutations run everywhere, behaviour-neutral by construction), and the client
 * assistant view is overridden and reset on a throwaway organization.
 */
@Tag("saas")
@DisplayName("AI settings")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class AiSettingsTest extends BaseTest {

    private static final RunId RUN_ID = RunId.next();
    private static final Set<String> PROVIDERS = Set.of("ANTHROPIC", "OPENAI", "GOOGLE_GEMINI");
    private static final Set<String> ANSWER_STYLES = Set.of("SHORT", "STANDARD", "DETAILED", "CUSTOM");

    private static Organization organization;

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
        assertThat(AiSettingsApi.resetClientView(orgId).getUserErrors()).as("Resetting again is harmless").isEmpty();
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
        if (organization != null) {
            try {
                AiSettingsApi.resetClientView(organization.getOrganizationId());
            } catch (RuntimeException ignored) {
                // best effort
            }
            try {
                OrganizationApi.archiveOrganization(organization);
            } catch (RuntimeException ignored) {
                // best effort: a failed cleanup must not mask the case that failed
            }
        }
    }
}
