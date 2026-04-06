package com.openframe.test.api;

import com.openframe.test.data.dto.script.RunScriptRequest;
import com.openframe.test.data.dto.script.Script;
import io.restassured.http.ContentType;

import java.util.List;

import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static io.restassured.RestAssured.given;

public class ScriptApi {

    private static final String SCRIPTS = "tools/tactical-rmm/scripts/";
    private static final String SCRIPT = SCRIPTS + "{id}/";
    private static final String RUN_SCRIPT = "tools/tactical-rmm/agents/actions/bulk/";

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
}
