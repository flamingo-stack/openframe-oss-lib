package com.openframe.test.api;

import com.openframe.test.data.dto.aisettings.AgentAiConfig;
import com.openframe.test.data.dto.aisettings.AiConfiguration;
import com.openframe.test.data.dto.aisettings.AiConfigurationRequest;
import com.openframe.test.data.dto.aisettings.AiConfigurationTestResult;
import com.openframe.test.data.dto.aisettings.AiPolicySummary;
import com.openframe.test.data.dto.aisettings.AgentAiConfigInput;
import com.openframe.test.data.dto.aisettings.AgentAiConfigPayload;
import com.openframe.test.data.dto.aisettings.ClientView;
import com.openframe.test.data.dto.aisettings.ClientViewInput;
import com.openframe.test.data.dto.aisettings.ClientViewPayload;
import com.openframe.test.data.dto.aisettings.OrganizationClientAiConfig;
import com.openframe.test.data.dto.aisettings.OrganizationClientAiConfigPayload;
import com.openframe.test.data.dto.aisettings.OrganizationGuardrails;
import com.openframe.test.data.dto.aisettings.OrganizationGuardrailsInput;
import com.openframe.test.data.dto.aisettings.OrganizationGuardrailsPayload;
import com.openframe.test.data.dto.aisettings.SupportedModel;
import io.restassured.common.mapper.TypeRef;
import io.restassured.http.ContentType;
import io.restassured.path.json.JsonPath;
import io.restassured.response.Response;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.AiSettingsQueries.ADMIN_AI_CONFIG;
import static com.openframe.test.api.graphql.AiSettingsQueries.CLIENT_AI_CONFIG;
import static com.openframe.test.api.graphql.AiSettingsQueries.CLIENT_VIEW;
import static com.openframe.test.api.graphql.AiSettingsQueries.ORGANIZATION_CLIENT_AI_CONFIG;
import static com.openframe.test.api.graphql.AiSettingsQueries.ORGANIZATION_GUARDRAILS;
import static com.openframe.test.api.graphql.AiSettingsQueries.RESET_CLIENT_VIEW;
import static com.openframe.test.api.graphql.AiSettingsQueries.RESET_ORGANIZATION_CLIENT_AI_CONFIG;
import static com.openframe.test.api.graphql.AiSettingsQueries.RESET_ORGANIZATION_CLIENT_AI_QUICK_ACTIONS;
import static com.openframe.test.api.graphql.AiSettingsQueries.RESET_ORGANIZATION_GUARDRAILS;
import static com.openframe.test.api.graphql.AiSettingsQueries.UPDATE_ADMIN_AI_CONFIG;
import static com.openframe.test.api.graphql.AiSettingsQueries.UPDATE_CLIENT_AI_CONFIG;
import static com.openframe.test.api.graphql.AiSettingsQueries.UPDATE_CLIENT_VIEW;
import static com.openframe.test.api.graphql.AiSettingsQueries.UPDATE_ORGANIZATION_CLIENT_AI_CONFIG;
import static com.openframe.test.api.graphql.AiSettingsQueries.UPDATE_ORGANIZATION_GUARDRAILS;
import static com.openframe.test.config.EnvironmentConfig.CHAT_GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

/**
 * Client for the assistant AI settings on {@code chat/graphql}: the tenant-wide AI logic config of
 * the client (Fae) and admin (Mingo) assistants, and the client assistant view (tenant default or
 * per-organization override).
 */
public class AiSettingsApi {

    private static final String AI_CONFIGURATION = "chat/api/v1/ai-configuration";
    private static final String SUPPORTED_MODELS = "chat/api/v1/ai-configuration/supported-models";
    private static final String TEST_AI_CONFIGURATION = "chat/api/v1/ai-configuration/test";
    // Deferred surface (KG-15), read only for a guardrail template id per the owner's decision of 2026-10-01
    private static final String POLICIES = "chat/api/v1/policies";

    /**
     * The models this environment offers, keyed by provider group. Only these are honoured: a stored model
     * outside the list silently falls back to the provider default ({@code AgentChatModelResolver}), so a
     * case that switches models must pick from here rather than name one.
     */
    public static Map<String, List<SupportedModel>> supportedModels() {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .get(SUPPORTED_MODELS)
                .then().statusCode(200)
                .extract().as(new TypeRef<Map<String, List<SupportedModel>>>() {
                });
    }

    public static AgentAiConfig getClientAiConfig() {
        return object(CLIENT_AI_CONFIG, "clientAiConfig", Map.of(), AgentAiConfig.class);
    }

    public static AgentAiConfig getAdminAiConfig() {
        return object(ADMIN_AI_CONFIG, "adminAiConfig", Map.of(), AgentAiConfig.class);
    }

    /** {@code organizationId} null → the tenant default; set → that organization's override, or null. */
    public static ClientView getClientView(String organizationId) {
        Map<String, Object> variables = new HashMap<>();
        if (organizationId != null) {
            variables.put("organizationId", organizationId);
        }
        return object(CLIENT_VIEW, "clientView", variables, ClientView.class);
    }

    public static AgentAiConfigPayload updateClientAiConfig(AgentAiConfigInput input) {
        return object(UPDATE_CLIENT_AI_CONFIG, "updateClientAiConfig", Map.of("input", input), AgentAiConfigPayload.class);
    }

    public static AgentAiConfigPayload updateAdminAiConfig(AgentAiConfigInput input) {
        return object(UPDATE_ADMIN_AI_CONFIG, "updateAdminAiConfig", Map.of("input", input), AgentAiConfigPayload.class);
    }

    /** {@code organizationId} null targets the tenant default; set targets that organization's override. */
    public static ClientViewPayload updateClientView(String organizationId, ClientViewInput input) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("input", input);
        if (organizationId != null) {
            variables.put("organizationId", organizationId);
        }
        return object(UPDATE_CLIENT_VIEW, "updateClientView", variables, ClientViewPayload.class);
    }

    public static ClientViewPayload resetClientView(String organizationId) {
        return object(RESET_CLIENT_VIEW, "resetClientView", Map.of("organizationId", organizationId), ClientViewPayload.class);
    }

    // The tenant's active model configuration (the deprecated REST twin of the per-agent AI configs)
    public static AiConfiguration getAiConfiguration() {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .get(AI_CONFIGURATION)
                .then().statusCode(200)
                .extract().as(AiConfiguration.class);
    }

    // Saves a new active configuration and refreshes the assistants' model beans tenant-wide
    public static AiConfiguration saveAiConfiguration(AiConfigurationRequest request) {
        return given(getAuthorizedSpec())
                .contentType(ContentType.JSON)
                .body(request).post(AI_CONFIGURATION)
                .then().statusCode(200)
                .extract().as(AiConfiguration.class);
    }

    // A failed connection is still 200 with success=false
    public static AiConfigurationTestResult testAiConfiguration(AiConfigurationRequest request) {
        return testAiConfigurationRaw(request)
                .then().statusCode(200)
                .extract().as(AiConfigurationTestResult.class);
    }

    public static Response testAiConfigurationRaw(AiConfigurationRequest request) {
        return given(getAuthorizedSpec())
                .contentType(ContentType.JSON)
                .body(request).post(TEST_AI_CONFIGURATION);
    }

    public static List<AiPolicySummary> getAiPolicies() {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .get(POLICIES)
                .then().statusCode(200)
                .extract().jsonPath().getList(".", AiPolicySummary.class);
    }

    public static OrganizationClientAiConfig getOrganizationClientAiConfig(String organizationId) {
        return object(ORGANIZATION_CLIENT_AI_CONFIG, "organizationClientAiConfig",
                Map.of("organizationId", organizationId), OrganizationClientAiConfig.class);
    }

    public static OrganizationClientAiConfigPayload updateOrganizationClientAiConfig(String organizationId, AgentAiConfigInput input) {
        return object(UPDATE_ORGANIZATION_CLIENT_AI_CONFIG, "updateOrganizationClientAiConfig",
                Map.of("organizationId", organizationId, "input", input), OrganizationClientAiConfigPayload.class);
    }

    public static OrganizationClientAiConfigPayload resetOrganizationClientAiConfig(String organizationId) {
        return object(RESET_ORGANIZATION_CLIENT_AI_CONFIG, "resetOrganizationClientAiConfig",
                Map.of("organizationId", organizationId), OrganizationClientAiConfigPayload.class);
    }

    public static OrganizationClientAiConfigPayload resetOrganizationClientAiQuickActions(String organizationId) {
        return object(RESET_ORGANIZATION_CLIENT_AI_QUICK_ACTIONS, "resetOrganizationClientAiQuickActions",
                Map.of("organizationId", organizationId), OrganizationClientAiConfigPayload.class);
    }

    public static OrganizationGuardrails getOrganizationGuardrails(String organizationId) {
        return object(ORGANIZATION_GUARDRAILS, "organizationGuardrails",
                Map.of("organizationId", organizationId), OrganizationGuardrails.class);
    }

    public static OrganizationGuardrailsPayload updateOrganizationGuardrails(String organizationId, OrganizationGuardrailsInput input) {
        return object(UPDATE_ORGANIZATION_GUARDRAILS, "updateOrganizationGuardrails",
                Map.of("organizationId", organizationId, "input", input), OrganizationGuardrailsPayload.class);
    }

    public static OrganizationGuardrailsPayload resetOrganizationGuardrails(String organizationId) {
        return object(RESET_ORGANIZATION_GUARDRAILS, "resetOrganizationGuardrails",
                Map.of("organizationId", organizationId), OrganizationGuardrailsPayload.class);
    }

    // Cleanup forms: the HTTP status instead of an assertion, so a failed reset cannot mask a failed case
    public static int resetClientViewRaw(String organizationId) {
        return raw(RESET_CLIENT_VIEW, Map.of("organizationId", organizationId));
    }

    public static int resetOrganizationClientAiConfigRaw(String organizationId) {
        return raw(RESET_ORGANIZATION_CLIENT_AI_CONFIG, Map.of("organizationId", organizationId));
    }

    public static int resetOrganizationGuardrailsRaw(String organizationId) {
        return raw(RESET_ORGANIZATION_GUARDRAILS, Map.of("organizationId", organizationId));
    }

    private static int raw(String document, Map<String, Object> variables) {
        return given(getAuthorizedSpec())
                .body(Map.of("query", document, "variables", variables)).post(CHAT_GRAPHQL)
                .statusCode();
    }

    /**
     * Reads one object out of a document's answer. The response is held in a named local before a
     * field is read out of it, so a failure says which step produced nothing.
     */
    private static <T> T object(String document, String field, Map<String, Object> variables, Class<T> type) {
        JsonPath response = query(document, variables);
        return response.getObject("data." + field, type);
    }

    private static JsonPath query(String document, Map<String, Object> variables) {
        Map<String, Object> body = Map.of("query", document, "variables", variables);
        return given(getAuthorizedSpec())
                .body(body).post(CHAT_GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath();
    }
}
