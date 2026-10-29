package com.openframe.test.api;

import com.openframe.test.data.dto.tool.IntegratedTool;
import com.openframe.test.data.dto.tool.ToolFilterInput;
import com.openframe.test.data.dto.tool.ToolFilters;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.ToolQueries.INTEGRATED_TOOLS;
import static com.openframe.test.api.graphql.ToolQueries.TOOL_FILTERS;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

// integratedTools / toolFilters on api/graphql — the tool registry, read-only and unpaginated.
public class ToolApi {

    public static ToolFilters getToolFilters() {
        Map<String, String> body = Map.of("query", TOOL_FILTERS);
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.toolFilters", ToolFilters.class);
    }

    public static List<IntegratedTool> getIntegratedTools() {
        return queryIntegratedTools(Map.of());
    }

    public static List<IntegratedTool> getIntegratedTools(ToolFilterInput filter) {
        return queryIntegratedTools(Map.of("filter", filter));
    }

    public static List<IntegratedTool> getIntegratedTools(ToolFilterInput filter, String search) {
        return queryIntegratedTools(Map.of("filter", filter, "search", search));
    }

    public static List<IntegratedTool> searchIntegratedTools(String search) {
        return queryIntegratedTools(Map.of("search", search));
    }

    private static List<IntegratedTool> queryIntegratedTools(Map<String, Object> variables) {
        Map<String, Object> body = new HashMap<>();
        body.put("query", INTEGRATED_TOOLS);
        body.put("variables", variables);
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getList("data.integratedTools.tools", IntegratedTool.class);
    }
}
