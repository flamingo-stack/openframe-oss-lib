package com.openframe.test.api;

import com.openframe.test.data.dto.script.*;
import io.restassured.http.ContentType;

import java.util.List;
import java.util.Map;

import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static io.restassured.RestAssured.given;

public class ScriptApi {

    private static final String SCRIPTS = "tools/tactical-rmm/scripts/";
    private static final String SCRIPT = SCRIPTS + "{id}/";
    private static final String RUN_SCRIPT = "tools/tactical-rmm/agents/actions/bulk/";
    private static final String SCRIPT_SCHEDULES = "tools/tactical-rmm/script-schedules/";
    private static final String SCRIPT_SCHEDULE_AGENTS = SCRIPT_SCHEDULES + "{id}/agents/";
    private static final String SCRIPT_SCHEDULE_HISTORY = SCRIPT_SCHEDULES + "{id}/history/";

    public static List<Script> listScripts() {
        List<Script> scripts = given(getAuthorizedSpec())
                .get(SCRIPTS)
                .then().statusCode(200)
                .extract().jsonPath().getList(".", Script.class);
        return scripts.size() >= 10 ? scripts.subList(0, 9) : null;
    }

    public static Script getScript(Integer id) {
        return given(getAuthorizedSpec())
                .accept(ContentType.JSON)
                .pathParam("id", id)
                .get(SCRIPT).then().statusCode(200)
                .extract().as(Script.class);
    }

    public static String editScript(Script script) {
        return given(getAuthorizedSpec())
                .pathParam("id", script.getId())
                .body(script)
                .put(SCRIPT)
                .then().statusCode(200)
                .extract().asString();
    }

    public static String addScript(Script script) {
        return given(getAuthorizedSpec())
                .body(script)
                .post(SCRIPTS)
                .then().statusCode(200)
                .extract().asString();
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
