package com.openframe.test.api;

import com.openframe.test.data.dto.softwareaction.SoftwareActionDevice;
import com.openframe.test.data.dto.softwareaction.SoftwareActionDeviceFilterInput;
import com.openframe.test.data.dto.softwareaction.SoftwareActionFilterInput;
import com.openframe.test.data.dto.softwareaction.SoftwareActionFilters;
import com.openframe.test.data.dto.softwareaction.SoftwareActionRun;
import com.openframe.test.data.dto.softwareaction.SoftwareActionRunConnection;
import io.restassured.path.json.JsonPath;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.SoftwareActionQueries.GET_SOFTWARE_ACTION;
import static com.openframe.test.api.graphql.SoftwareActionQueries.GET_SOFTWARE_ACTIONS;
import static com.openframe.test.api.graphql.SoftwareActionQueries.GET_SOFTWARE_ACTION_EXECUTIONS;
import static com.openframe.test.api.graphql.SoftwareActionQueries.GET_SOFTWARE_ACTION_FILTERS;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

// Software action history client (read-only): the Software Actions list, one action, its dropdown counts and its device drill-down.
public class SoftwareActionApi {

    // One page, newest first; filter, search and after may be null.
    public static SoftwareActionRunConnection getActions(SoftwareActionFilterInput filter, String search, int first, String after) {
        Map<String, Object> variables = filterAndSearch(filter, search);
        variables.put("first", first);
        if (after != null) {
            variables.put("after", after);
        }
        return query(GET_SOFTWARE_ACTIONS, variables).getObject("data.softwareActions", SoftwareActionRunConnection.class);
    }

    // id is a SoftwareActionRun's opaque id; null when unknown.
    public static SoftwareActionRun getAction(String id) {
        return query(GET_SOFTWARE_ACTION, Map.of("id", id)).getObject("data.softwareAction", SoftwareActionRun.class);
    }

    public static SoftwareActionFilters getActionFilters(SoftwareActionFilterInput filter, String search) {
        return query(GET_SOFTWARE_ACTION_FILTERS, filterAndSearch(filter, search))
                .getObject("data.softwareActionFilters", SoftwareActionFilters.class);
    }

    // actionId is a SoftwareActionRun's opaque id; filter and search may be null.
    public static List<SoftwareActionDevice> getActionExecutions(String actionId, SoftwareActionDeviceFilterInput filter, String search) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("actionId", actionId);
        if (filter != null) {
            variables.put("filter", filter);
        }
        if (search != null) {
            variables.put("search", search);
        }
        return query(GET_SOFTWARE_ACTION_EXECUTIONS, variables)
                .getList("data.softwareActionExecutions", SoftwareActionDevice.class);
    }

    // ---- plumbing ----

    private static Map<String, Object> filterAndSearch(SoftwareActionFilterInput filter, String search) {
        Map<String, Object> variables = new HashMap<>();
        if (filter != null) {
            variables.put("filter", filter);
        }
        if (search != null) {
            variables.put("search", search);
        }
        return variables;
    }

    private static JsonPath query(String document, Map<String, Object> variables) {
        Map<String, Object> body = Map.of("query", document, "variables", variables);
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath();
    }
}
