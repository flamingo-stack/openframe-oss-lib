package com.openframe.test.api;

import com.openframe.test.data.dto.script.*;

import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.ScriptQueries.ARCHIVE_SCRIPT;
import static com.openframe.test.api.graphql.ScriptQueries.CREATE_SCRIPT;
import static com.openframe.test.api.graphql.ScriptQueries.DELETE_SCRIPT;
import static com.openframe.test.api.graphql.ScriptQueries.GET_SCRIPT;
import static com.openframe.test.api.graphql.ScriptQueries.SCRIPTS_TABLE_RELAY_QUERY;
import static com.openframe.test.api.graphql.ScriptQueries.UPDATE_SCRIPT;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

public class ScriptApi {

    public static List<Script> listScripts() {
        Map<String, Object> body = Map.of(
                "query", SCRIPTS_TABLE_RELAY_QUERY,
                "variables", Map.of(
                        "filter", Map.of("statuses", List.of("ACTIVE")),
                        "first", 20
                )
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getList("data.scripts.edges.node", Script.class);
    }

    public static Script getScript(String id) {
        Map<String, Object> body = Map.of(
                "query", GET_SCRIPT,
                "variables", Map.of("id", id)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.script", Script.class);
    }

    public static Script createScript(CreateScriptInput input) {
        Map<String, Object> body = Map.of(
                "query", CREATE_SCRIPT,
                "variables", Map.of("input", input)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.createScript", Script.class);
    }

    public static Script updateScript(UpdateScriptInput input) {
        Map<String, Object> body = Map.of(
                "query", UPDATE_SCRIPT,
                "variables", Map.of("input", input)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.updateScript", Script.class);
    }

    public static String deleteScript(String id) {
        Map<String, Object> body = Map.of(
                "query", DELETE_SCRIPT,
                "variables", Map.of("id", id)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getString("data.deleteScript");
    }

    public static Script archiveScript(String id) {
        Map<String, Object> body = Map.of(
                "query", ARCHIVE_SCRIPT,
                "variables", Map.of("id", id)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.archiveScript", Script.class);
    }
}
