package com.openframe.test.api;

import com.openframe.test.data.dto.device.DeviceLogConnection;
import com.openframe.test.data.dto.device.DeviceLogFilterInput;
import com.openframe.test.data.dto.shared.GraphqlError;
import io.restassured.response.Response;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.DeviceLogQueries.DEVICE_LOGS;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

// Device agent logs (deviceLogs), read-only and always scoped to the caller's tenant.
public class DeviceLogApi {

    // One page, newest first; null machineIds reads every device of the tenant, after is the previous page's endCursor or null.
    public static DeviceLogConnection deviceLogs(List<String> machineIds, DeviceLogFilterInput filter, Integer first, String after) {
        Map<String, Object> body = Map.of("query", DEVICE_LOGS, "variables", variables(null, machineIds, filter, first, after));
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.deviceLogs", DeviceLogConnection.class);
    }

    // One page through the deprecated single-device argument.
    public static DeviceLogConnection deviceLogsByMachineId(String machineId, DeviceLogFilterInput filter, Integer first) {
        Map<String, Object> body = Map.of("query", DEVICE_LOGS, "variables", variables(machineId, null, filter, first, null));
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.deviceLogs", DeviceLogConnection.class);
    }

    // A query expected to be refused; returns its GraphQL errors, and a non-200 answer fails with the status and body.
    public static List<GraphqlError> attemptDeviceLogsErrors(List<String> machineIds, DeviceLogFilterInput filter, Integer first, String after) {
        Map<String, Object> body = Map.of("query", DEVICE_LOGS, "variables", variables(null, machineIds, filter, first, after));
        Response response = given(getAuthorizedSpec()).body(body).post(GRAPHQL);
        if (response.statusCode() != 200) {
            throw new AssertionError("api/graphql answered HTTP " + response.statusCode()
                    + " to deviceLogs instead of 200 with a GraphQL error; body: "
                    + response.asString().replaceAll("\\s+", " ").strip());
        }
        List<GraphqlError> errors = response.jsonPath().getList("errors", GraphqlError.class);
        return errors == null ? List.of() : errors;
    }

    private static Map<String, Object> variables(String machineId, List<String> machineIds, DeviceLogFilterInput filter,
                                                 Integer first, String after) {
        Map<String, Object> variables = new HashMap<>();
        if (machineId != null) {
            variables.put("machineId", machineId);
        }
        if (machineIds != null) {
            variables.put("machineIds", machineIds);
        }
        if (filter != null) {
            variables.put("filter", filter);
        }
        if (first != null) {
            variables.put("first", first);
        }
        if (after != null) {
            variables.put("after", after);
        }
        return variables;
    }
}
