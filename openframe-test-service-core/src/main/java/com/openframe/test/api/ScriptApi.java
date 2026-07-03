package com.openframe.test.api;

import com.openframe.test.data.dto.script.*;
import io.restassured.http.ContentType;

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

    private static final String RUN_SCRIPT = "tools/tactical-rmm/agents/actions/bulk/";
    private static final String SCRIPT_SCHEDULES = "tools/tactical-rmm/script-schedules/";
    private static final String SCRIPT_SCHEDULE_AGENTS = SCRIPT_SCHEDULES + "{id}/agents/";
    private static final String SCRIPT_SCHEDULE_HISTORY = SCRIPT_SCHEDULES + "{id}/history/";

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

    public static String runScript(RunScriptRequest request) {
        return given(getAuthorizedSpec())
                .body(request)
                .post(RUN_SCRIPT)
                .then().statusCode(200)
                .extract().asString();
    }

    public static ScriptSchedule createScriptSchedule(CreateScriptScheduleRequest request) {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .body(request)
                .post(SCRIPT_SCHEDULES)
                .then().statusCode(200)
                .extract().as(ScriptSchedule.class);
    }

    public static ScheduleAssignDeviceResponse scheduleAssignDevice(Integer scheduleId, String... agents) {
        return given(getAuthorizedSpec())
                .pathParam("id", scheduleId)
                .accept(ContentType.JSON)
                .body(Map.of("agents", List.of(agents)))
                .put(SCRIPT_SCHEDULE_AGENTS)
                .then().statusCode(200)
                .extract().as(ScheduleAssignDeviceResponse.class);
    }

    public static ScheduleExecutionHistory getScheduleExecutionHistory(Integer scheduleId) {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .pathParam("id", scheduleId)
                .queryParam("limit", 50)
                .get(SCRIPT_SCHEDULE_HISTORY)
                .then().statusCode(200)
                .extract().as(ScheduleExecutionHistory.class);
    }

    public static List<ScriptSchedule> getScriptSchedules() {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .get(SCRIPT_SCHEDULES)
                .then().statusCode(200)
                .extract().jsonPath().getList(".", ScriptSchedule.class);
    }
}
