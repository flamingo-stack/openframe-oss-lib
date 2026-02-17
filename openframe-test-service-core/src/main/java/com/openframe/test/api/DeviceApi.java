package com.openframe.test.api;

import com.openframe.test.data.dto.device.*;
import com.openframe.test.data.dto.device.fleet.FleetHost;
import com.openframe.test.data.dto.shared.CursorPaginationInput;
import io.restassured.response.Response;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.DeviceQueries.*;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getBaseUrl;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static io.restassured.RestAssured.given;

public class DeviceApi {

    private static final String DEVICES = "api/devices/{machineId}";
    private static final String FLEET_HOST = "tools/fleetmdm-server/api/latest/fleet/hosts/{fleetId}";

    public static List<String> getDeviceHostnames(DeviceFilterInput filter) {
        Map<String, Object> body = new HashMap<>();
        body.put("query", DEVICE_HOSTNAMES);
        body.put("variables", Map.of("filter", filter));
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().statusCode(200)
                .extract().jsonPath().getList("data.devices.edges.node.hostname", String.class);
    }

    public static List<String> getDeviceIds(DeviceFilterInput filter) {
        Map<String, Object> body = new HashMap<>();
        body.put("query", DEVICE_IDS);
        body.put("variables", Map.of("filter", filter));
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().statusCode(200)
                .extract().jsonPath().get("data.devices.edges.node.machineId");
    }

    public static Machine getDevice(String machineId) {
        Map<String, Object> body = Map.of(
                "query", FULL_DEVICE,
                "variables", Map.of("machineId", machineId)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().statusCode(200)
                .extract().jsonPath().getObject("data.device", Machine.class);
    }

    public static Machine getAnyDevice(DeviceFilterInput... filters) {
        for (DeviceFilterInput filter : filters) {
            List<Machine> devices = getDevices(filter);
            if (!devices.isEmpty()) {
                return devices.getFirst();
            }
        }
        return null;
    }

    public static List<Machine> getDevices(DeviceFilterInput filter) {
        Map<String, Object> body = new HashMap<>();
        body.put("query", DEVICES_WITH_FILTER);
        body.put("variables", Map.of("filter", filter));
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().statusCode(200)
                .extract().jsonPath().getList("data.devices.edges.node", Machine.class);
    }

    public static List<String> getAllDevices(DeviceFilterInput filter, CursorPaginationInput pagination) {
        List<String> fleetIds = new ArrayList<>();
        String cursor = pagination.getCursor();
        boolean hasNextPage = true;

        while (hasNextPage) {
            Map<String, Object> variables = new HashMap<>();
            variables.put("filter", filter);
            variables.put("pagination", CursorPaginationInput.builder()
                    .limit(pagination.getLimit())
                    .cursor(cursor)
                    .build());
            Map<String, Object> body = new HashMap<>();
            body.put("query", ALL_DEVICES);
            body.put("variables", variables);

            var responseR = given(getAuthorizedSpec())
                    .body(body).post(GRAPHQL);
            if (responseR.statusCode() == 200) {
                var response = responseR.then()
                        .extract().jsonPath();

                List<DeviceWithConnections> devices = response.getList(
                        "data.devices.edges.node", DeviceWithConnections.class);

                for (DeviceWithConnections device : devices) {
                    device.getToolConnections().stream()
                            .filter(tc -> "FLEET_MDM".equals(tc.getToolType()))
                            .findFirst()
                            .map(ToolConnection::getAgentToolId)
                            .ifPresent(fleetIds::add);
                }

                Boolean next = response.getObject("data.devices.pageInfo.hasNextPage", Boolean.class);
                hasNextPage = Boolean.TRUE.equals(next);
                cursor = response.getString("data.devices.pageInfo.endCursor");
            } else {
                System.out.printf("%s -> %d%n", getBaseUrl(), responseR.getStatusCode());
            }

        }

        return fleetIds;
    }

    public static void updateDeviceStatus(Machine device, DeviceStatus status) {
        given(getAuthorizedSpec())
                .pathParam("machineId", device.getMachineId())
                .body(Map.of("status", status))
                .patch(DEVICES)
                .then().statusCode(204);
    }

    public static void archiveDevice(Machine device) {
        updateDeviceStatus(device, DeviceStatus.ARCHIVED);
    }

    public static void deleteDevice(Machine device) {
        updateDeviceStatus(device, DeviceStatus.DELETED);
    }

    public static Machine searchDevice(DeviceFilterInput filter, String search) {
        Map<String, Object> body = new HashMap<>();
        body.put("query", SEARCH_DEVICE);
        body.put("variables", Map.of("filter", filter, "search", search));
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().statusCode(200)
                .extract().jsonPath().getObject("data.devices.edges[0].node", Machine.class);
    }

    public static FleetHost getFleetInfo(String fleetId) {
        return given(getAuthorizedSpec())
                .pathParam("fleetId", fleetId)
                .get(FLEET_HOST)
                .then().statusCode(200)
                .extract().jsonPath().getObject("host", FleetHost.class);
    }

    public static String getFleetOsVersion(String fleetId) {
        Response response = given(getAuthorizedSpec())
                .pathParam("fleetId", fleetId)
                .get(FLEET_HOST);
        if (response.getStatusCode() == 200) {
            return response.then().extract().jsonPath().getString("host.os_version");
        } else {
            System.out.printf("%s%s -> %d%n", getBaseUrl(), FLEET_HOST.replace("{fleetId}", fleetId), response.getStatusCode());
        }
        return null;
    }

    public static DeviceFilters getDeviceFilters() {
        Map<String, String> body = Map.of("query", DEVICE_FILTERS);
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().statusCode(200)
                .extract().jsonPath().getObject("data.deviceFilters", DeviceFilters.class);
    }
}
