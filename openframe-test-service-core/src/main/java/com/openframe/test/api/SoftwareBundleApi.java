package com.openframe.test.api;

import com.openframe.test.data.dto.device.DeviceFilterInput;
import com.openframe.test.data.dto.shared.GraphqlError;
import com.openframe.test.data.dto.softwarebundle.SoftwareBundle;
import com.openframe.test.data.dto.softwarebundle.SubmitSoftwareBundleInput;
import io.restassured.path.json.JsonPath;
import io.restassured.response.Response;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.SoftwareBundleQueries.ADD_ALL_DEVICES_TO_SOFTWARE_BUNDLE;
import static com.openframe.test.api.graphql.SoftwareBundleQueries.ADD_DEVICES_TO_SOFTWARE_BUNDLE;
import static com.openframe.test.api.graphql.SoftwareBundleQueries.CREATE_SOFTWARE_BUNDLE;
import static com.openframe.test.api.graphql.SoftwareBundleQueries.DELETE_SOFTWARE_BUNDLE;
import static com.openframe.test.api.graphql.SoftwareBundleQueries.GET_SOFTWARE_BUNDLE;
import static com.openframe.test.api.graphql.SoftwareBundleQueries.GET_SOFTWARE_BUNDLE_DEVICES;
import static com.openframe.test.api.graphql.SoftwareBundleQueries.REMOVE_ALL_DEVICES_FROM_SOFTWARE_BUNDLE;
import static com.openframe.test.api.graphql.SoftwareBundleQueries.REMOVE_DEVICES_FROM_SOFTWARE_BUNDLE;
import static com.openframe.test.api.graphql.SoftwareBundleQueries.SUBMIT_SOFTWARE_BUNDLE;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

// Software bundle client: the draft lifecycle (create, read, assign/unassign devices, delete) and its submit.
public class SoftwareBundleApi {

    public static SoftwareBundle createBundle() {
        return object(CREATE_SOFTWARE_BUNDLE, "createSoftwareBundle", Map.of());
    }

    // Null when the bundle does not exist or was already deleted or reaped.
    public static SoftwareBundle getBundle(String id) {
        return object(GET_SOFTWARE_BUNDLE, "softwareBundle", Map.of("id", id));
    }

    // The bundle with both pickers narrowed by filter and search; filter and search may be null.
    public static SoftwareBundle getBundleDevices(String id, DeviceFilterInput filter, String search, int first) {
        Map<String, Object> variables = deviceSelection("id", id, filter, search);
        variables.put("first", first);
        return object(GET_SOFTWARE_BUNDLE_DEVICES, "softwareBundle", variables);
    }

    // machineIds are Machine global ids; already-assigned ids are skipped.
    public static SoftwareBundle addDevices(String bundleId, List<String> machineIds) {
        return object(ADD_DEVICES_TO_SOFTWARE_BUNDLE, "addDevicesToSoftwareBundle",
                Map.of("bundleId", bundleId, "machineIds", machineIds));
    }

    // Ids that are not assigned are no-ops.
    public static SoftwareBundle removeDevices(String bundleId, List<String> machineIds) {
        return object(REMOVE_DEVICES_FROM_SOFTWARE_BUNDLE, "removeDevicesFromSoftwareBundle",
                Map.of("bundleId", bundleId, "machineIds", machineIds));
    }

    // Assigns every device the bundle's availableDevices would list for the same filter and search.
    public static SoftwareBundle addAllDevices(String bundleId, DeviceFilterInput filter, String search) {
        return object(ADD_ALL_DEVICES_TO_SOFTWARE_BUNDLE, "addAllDevicesToSoftwareBundle",
                deviceSelection("bundleId", bundleId, filter, search));
    }

    // Unassigns every assigned device matching filter and search; with neither it clears the assignment.
    public static SoftwareBundle removeAllDevices(String bundleId, DeviceFilterInput filter, String search) {
        return object(REMOVE_ALL_DEVICES_FROM_SOFTWARE_BUNDLE, "removeAllDevicesFromSoftwareBundle",
                deviceSelection("bundleId", bundleId, filter, search));
    }

    // An assignment expected to be refused (a COMPLETED bundle); returns the GraphQL errors.
    public static List<GraphqlError> attemptAddDevicesErrors(String bundleId, List<String> machineIds) {
        return errorsOf(ADD_DEVICES_TO_SOFTWARE_BUNDLE, Map.of("bundleId", bundleId, "machineIds", machineIds));
    }

    // Validates, runs it now (no schedule) and marks the bundle COMPLETED; an already COMPLETED bundle comes back unchanged.
    public static SoftwareBundle submitBundle(SubmitSoftwareBundleInput input) {
        return object(SUBMIT_SOFTWARE_BUNDLE, "submitSoftwareBundle", Map.of("input", input));
    }

    // A submit expected to be refused (no devices, no packages, an invalid package, an unknown bundle); returns the GraphQL errors.
    public static List<GraphqlError> attemptSubmitBundleErrors(SubmitSoftwareBundleInput input) {
        return errorsOf(SUBMIT_SOFTWARE_BUNDLE, Map.of("input", input));
    }

    // True for a PENDING, unknown or reaped id; false for a COMPLETED bundle, which is left untouched.
    public static boolean deleteBundle(String id) {
        JsonPath response = query(DELETE_SOFTWARE_BUNDLE, Map.of("id", id));
        return response.getBoolean("data.deleteSoftwareBundle");
    }

    // Teardown form: sends the delete and returns the HTTP status without asserting on it.
    public static int attemptDeleteBundle(String id) {
        Map<String, Object> body = Map.of("query", DELETE_SOFTWARE_BUNDLE, "variables", Map.of("id", id));
        return given(getAuthorizedSpec()).body(body).post(GRAPHQL).statusCode();
    }

    // ---- plumbing ----

    private static Map<String, Object> deviceSelection(String idName, String id, DeviceFilterInput filter, String search) {
        Map<String, Object> variables = new HashMap<>();
        variables.put(idName, id);
        if (filter != null) {
            variables.put("filter", filter);
        }
        if (search != null) {
            variables.put("search", search);
        }
        return variables;
    }

    private static SoftwareBundle object(String document, String field, Map<String, Object> variables) {
        JsonPath response = query(document, variables);
        return response.getObject("data." + field, SoftwareBundle.class);
    }

    private static JsonPath query(String document, Map<String, Object> variables) {
        Map<String, Object> body = Map.of("query", document, "variables", variables);
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath();
    }

    // Sends a document without the success spec and returns its GraphQL errors; a non-200 answer fails with the status and body.
    private static List<GraphqlError> errorsOf(String document, Map<String, Object> variables) {
        Map<String, Object> body = Map.of("query", document, "variables", variables);
        Response response = given(getAuthorizedSpec()).body(body).post(GRAPHQL);
        if (response.statusCode() != 200) {
            String operation = document.lines().findFirst().orElse("").trim();
            throw new AssertionError("api/graphql answered HTTP " + response.statusCode() + " to \"" + operation
                    + "\" instead of 200 with a GraphQL error; body: "
                    + response.asString().replaceAll("\\s+", " ").strip());
        }
        List<GraphqlError> errors = response.jsonPath().getList("errors", GraphqlError.class);
        return errors == null ? List.of() : errors;
    }
}
