package com.openframe.test.api;

import com.openframe.test.data.dto.aisettings.AgentAiConfig;
import com.openframe.test.data.dto.aisettings.AgentAiConfigInput;
import com.openframe.test.data.dto.aisettings.AgentAiConfigPayload;
import com.openframe.test.data.dto.aisettings.ClientView;
import com.openframe.test.data.dto.aisettings.ClientViewInput;
import com.openframe.test.data.dto.aisettings.ClientViewPayload;
import io.restassured.path.json.JsonPath;

import java.util.HashMap;
import java.util.Map;

import static com.openframe.test.api.graphql.AiSettingsQueries.ADMIN_AI_CONFIG;
import static com.openframe.test.api.graphql.AiSettingsQueries.CLIENT_AI_CONFIG;
import static com.openframe.test.api.graphql.AiSettingsQueries.CLIENT_VIEW;
import static com.openframe.test.api.graphql.AiSettingsQueries.RESET_CLIENT_VIEW;
import static com.openframe.test.api.graphql.AiSettingsQueries.UPDATE_ADMIN_AI_CONFIG;
import static com.openframe.test.api.graphql.AiSettingsQueries.UPDATE_CLIENT_AI_CONFIG;
import static com.openframe.test.api.graphql.AiSettingsQueries.UPDATE_CLIENT_VIEW;
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
