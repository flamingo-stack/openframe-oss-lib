package com.openframe.test.api.external;

import com.openframe.test.data.dto.external.tool.ToolFilterResponse;
import com.openframe.test.data.dto.external.tool.ToolsResponse;
import io.restassured.response.Response;

import java.util.Map;

import static com.openframe.test.helpers.RequestSpecHelper.getExternalApiSpec;
import static io.restassured.RestAssured.given;

/** External API client for {@code /api/v1/tools}. Read-only; both endpoints are unpaginated. */
public class ExternalToolApi {

    private static final String TOOLS = "api/v1/tools";
    private static final String FILTERS = TOOLS + "/filters";

    public static ToolsResponse listTools() {
        return listTools(Map.of());
    }

    public static ToolsResponse listTools(Map<String, Object> queryParams) {
        return given(getExternalApiSpec())
                .queryParams(queryParams)
                .get(TOOLS)
                .then().statusCode(200)
                .extract().as(ToolsResponse.class);
    }

    public static Response listToolsRaw(Map<String, Object> queryParams) {
        return given(getExternalApiSpec()).queryParams(queryParams).get(TOOLS);
    }

    public static ToolFilterResponse getFilters() {
        return given(getExternalApiSpec())
                .get(FILTERS)
                .then().statusCode(200)
                .extract().as(ToolFilterResponse.class);
    }
}
