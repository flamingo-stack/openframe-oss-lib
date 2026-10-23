package com.openframe.test.api;

import com.openframe.test.data.dto.execution.ScriptExecutionConnection;
import com.openframe.test.data.dto.execution.ScriptExecutionFilters;
import com.openframe.test.data.dto.script.*;
import com.openframe.test.data.dto.shared.GraphqlError;

import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.ScriptQueries.RUN_SCRIPT;
import static com.openframe.test.api.graphql.ScriptQueries.ARCHIVE_SCRIPT;
import static com.openframe.test.api.graphql.ScriptQueries.BATCH_RUN_SCRIPT;
import static com.openframe.test.api.graphql.ScriptQueries.CREATE_SCRIPT;
import static com.openframe.test.api.graphql.ScriptQueries.DELETE_SCRIPT;
import static com.openframe.test.api.graphql.ScriptQueries.GET_SCRIPT;
import static com.openframe.test.api.graphql.ScriptQueries.SCRIPTS_TABLE_RELAY_QUERY;
import static com.openframe.test.api.graphql.ScriptQueries.SCRIPT_EXECUTIONS;
import static com.openframe.test.api.graphql.ScriptQueries.SCRIPT_EXECUTION_FILTERS;
import static com.openframe.test.api.graphql.ScriptQueries.UNARCHIVE_SCRIPT;
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

    // Teardown form: sends the delete and returns the HTTP status without asserting on it.
    public static int attemptDeleteScript(String id) {
        Map<String, Object> body = Map.of("query", DELETE_SCRIPT, "variables", Map.of("id", id));
        return given(getAuthorizedSpec()).body(body).post(GRAPHQL).statusCode();
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

    public static Script unarchiveScript(String id) {
        Map<String, Object> body = Map.of(
                "query", UNARCHIVE_SCRIPT,
                "variables", Map.of("id", id)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.unarchiveScript", Script.class);
    }

    /**
     * Dispatch a saved script to one machine and return the executionId Fleet correlates the agent's
     * asynchronous result by. Nothing is persisted by the call itself — the row this produces in the
     * script's history arrives once the agent reports, so a caller asserting on history must poll.
     */
    public static String runScript(String machineId, String scriptId, String privilegeLevel) {
        return runScript(RunScriptInput.builder().machineId(machineId).scriptId(scriptId).privilegeLevel(privilegeLevel).build());
    }

    // Dispatch with per-run overrides (args, timeout, env vars merged over the stored ones); returns the executionId.
    public static String runScript(RunScriptInput input) {
        return given(getAuthorizedSpec())
                .body(Map.of("query", RUN_SCRIPT, "variables", Map.of("input", input)))
                .post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getString("data.runScript.executionId");
    }

    // One saved script to several machines under a single shared executionId, which is returned.
    public static String batchRunScript(BatchRunScriptInput input) {
        return given(getAuthorizedSpec())
                .body(Map.of("query", BATCH_RUN_SCRIPT, "variables", Map.of("input", input)))
                .post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getString("data.batchRunScript.executionId");
    }

    // A batch dispatch expected to be refused; returns the top-level GraphQL errors, empty when it was accepted.
    public static List<GraphqlError> attemptBatchRunScriptErrors(BatchRunScriptInput input) {
        List<GraphqlError> errors = given(getAuthorizedSpec())
                .body(Map.of("query", BATCH_RUN_SCRIPT, "variables", Map.of("input", input)))
                .post(GRAPHQL)
                .then().statusCode(200)
                .extract().jsonPath().getList("errors", GraphqlError.class);
        return errors == null ? List.of() : errors;
    }

    /** Execution history of one script, newest first. */
    public static ScriptExecutionConnection getExecutions(String scriptId, int first) {
        return given(getAuthorizedSpec())
                .body(Map.of("query", SCRIPT_EXECUTIONS, "variables", Map.of("scriptId", scriptId, "first", first)))
                .post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.scriptExecutions", ScriptExecutionConnection.class);
    }

    public static ScriptExecutionFilters getExecutionFilters(String scriptId) {
        return given(getAuthorizedSpec())
                .body(Map.of("query", SCRIPT_EXECUTION_FILTERS, "variables", Map.of("scriptId", scriptId)))
                .post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.scriptExecutionFilters", ScriptExecutionFilters.class);
    }
}
