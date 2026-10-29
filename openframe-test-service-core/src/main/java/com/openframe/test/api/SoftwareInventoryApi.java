package com.openframe.test.api;

import com.openframe.test.data.dto.device.DeviceConnection;
import com.openframe.test.data.dto.shared.GraphqlError;
import com.openframe.test.data.dto.shared.SortInput;
import com.openframe.test.data.dto.software.Software;
import com.openframe.test.data.dto.software.SoftwareConnection;
import com.openframe.test.data.dto.software.SoftwareFilterInput;
import com.openframe.test.data.dto.software.SoftwareFilters;
import com.openframe.test.data.dto.software.SoftwareOnDeviceConnection;
import com.openframe.test.data.dto.software.SoftwareOnDeviceFilterInput;
import com.openframe.test.data.dto.software.SoftwareOnDeviceFilters;
import com.openframe.test.data.dto.software.SoftwareVulnerabilityConnection;
import com.openframe.test.data.dto.software.Vulnerability;
import com.openframe.test.data.dto.software.VulnerabilityConnection;
import com.openframe.test.data.dto.software.VulnerabilityFilterInput;
import com.openframe.test.data.dto.software.VulnerabilityFilters;
import io.restassured.path.json.JsonPath;
import io.restassured.response.Response;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.SoftwareInventoryQueries.*;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

// Software inventory and vulnerability reads (Fleet MDM behind api/graphql); read-only. Software ids are the ids the lists return, CVEs and machineIds are plain strings.
public class SoftwareInventoryApi {

    // ---- fleet-wide software ----

    // One page of titles; after is the previous page's pageInfo.endCursor, or null.
    public static SoftwareConnection getSoftwares(SoftwareFilterInput filter, String search, SortInput sort, Integer first, String after) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("filter", filter);
        variables.put("search", search);
        variables.put("sort", sort);
        variables.put("first", first);
        variables.put("after", after);
        return query(SOFTWARES, variables).getObject("data.softwares", SoftwareConnection.class);
    }

    // A softwares read expected to be refused (an unknown sort field); returns the GraphQL errors.
    public static List<GraphqlError> attemptSoftwaresErrors(SortInput sort) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("sort", sort);
        return errorsOf(SOFTWARES, variables);
    }

    // Null when the id names no software title.
    public static Software getSoftware(String id) {
        return query(SOFTWARE, Map.of("id", id)).getObject("data.software", Software.class);
    }

    public static SoftwareFilters getSoftwareFilters(String search) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("search", search);
        return query(SOFTWARE_FILTERS, variables).getObject("data.softwareFilters", SoftwareFilters.class);
    }

    public static SoftwareOnDeviceConnection getSoftwareDevices(String softwareId, SoftwareOnDeviceFilterInput filter, String search) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("softwareId", softwareId);
        variables.put("filter", filter);
        variables.put("search", search);
        return query(SOFTWARE_DEVICES, variables).getObject("data.softwareDevices", SoftwareOnDeviceConnection.class);
    }

    public static SoftwareOnDeviceFilters getSoftwareDeviceFilters(String softwareId) {
        return query(SOFTWARE_DEVICE_FILTERS, Map.of("softwareId", softwareId))
                .getObject("data.softwareDeviceFilters", SoftwareOnDeviceFilters.class);
    }

    public static SoftwareVulnerabilityConnection getSoftwareVulnerabilities(String softwareId, String search, SortInput sort) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("softwareId", softwareId);
        variables.put("search", search);
        variables.put("sort", sort);
        return query(SOFTWARE_VULNERABILITIES, variables)
                .getObject("data.softwareVulnerabilities", SoftwareVulnerabilityConnection.class);
    }

    // ---- fleet-wide vulnerabilities ----

    public static VulnerabilityConnection getVulnerabilities(VulnerabilityFilterInput filter, SortInput sort, Integer first) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("filter", filter);
        variables.put("sort", sort);
        variables.put("first", first);
        return query(VULNERABILITIES, variables).getObject("data.vulnerabilities", VulnerabilityConnection.class);
    }

    // Null when Fleet has no record of the CVE.
    public static Vulnerability getVulnerability(String cveId) {
        return query(VULNERABILITY, Map.of("cveId", cveId)).getObject("data.vulnerability", Vulnerability.class);
    }

    public static VulnerabilityFilters getVulnerabilityFilters() {
        return query(VULNERABILITY_FILTERS, Map.of()).getObject("data.vulnerabilityFilters", VulnerabilityFilters.class);
    }

    public static DeviceConnection getVulnerabilityDevices(String cveId) {
        return query(VULNERABILITY_DEVICES, Map.of("cveId", cveId)).getObject("data.vulnerabilityDevices", DeviceConnection.class);
    }

    // ---- one device ----

    public static SoftwareConnection getDeviceSoftware(String machineId, SoftwareFilterInput filter, String search, SortInput sort) {
        return query(DEVICE_SOFTWARE, deviceVariables(machineId, filter, search, sort))
                .getObject("data.deviceSoftware", SoftwareConnection.class);
    }

    // A deviceSoftware read expected to be refused (unknown machineId, unknown sort field); returns the GraphQL errors.
    public static List<GraphqlError> attemptDeviceSoftwareErrors(String machineId, SortInput sort) {
        return errorsOf(DEVICE_SOFTWARE, deviceVariables(machineId, null, null, sort));
    }

    public static SoftwareFilters getDeviceSoftwareFilters(String machineId, String search) {
        return query(DEVICE_SOFTWARE_FILTERS, deviceFiltersVariables(machineId, search))
                .getObject("data.deviceSoftwareFilters", SoftwareFilters.class);
    }

    public static List<GraphqlError> attemptDeviceSoftwareFiltersErrors(String machineId) {
        return errorsOf(DEVICE_SOFTWARE_FILTERS, deviceFiltersVariables(machineId, null));
    }

    public static VulnerabilityConnection getDeviceVulnerabilities(String machineId, VulnerabilityFilterInput filter, String search,
                                                                   SortInput sort) {
        return query(DEVICE_VULNERABILITIES, deviceVariables(machineId, filter, search, sort))
                .getObject("data.deviceVulnerabilities", VulnerabilityConnection.class);
    }

    // A deviceVulnerabilities read expected to be refused (unknown machineId, unknown sort field); returns the GraphQL errors.
    public static List<GraphqlError> attemptDeviceVulnerabilitiesErrors(String machineId, SortInput sort) {
        return errorsOf(DEVICE_VULNERABILITIES, deviceVariables(machineId, null, null, sort));
    }

    public static VulnerabilityFilters getDeviceVulnerabilityFilters(String machineId, String search) {
        return query(DEVICE_VULNERABILITY_FILTERS, deviceFiltersVariables(machineId, search))
                .getObject("data.deviceVulnerabilityFilters", VulnerabilityFilters.class);
    }

    public static List<GraphqlError> attemptDeviceVulnerabilityFiltersErrors(String machineId) {
        return errorsOf(DEVICE_VULNERABILITY_FILTERS, deviceFiltersVariables(machineId, null));
    }

    // ---- plumbing ----

    private static Map<String, Object> deviceVariables(String machineId, Object filter, String search, SortInput sort) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("machineId", machineId);
        variables.put("filter", filter);
        variables.put("search", search);
        variables.put("sort", sort);
        return variables;
    }

    // The filters documents declare only machineId and search.
    private static Map<String, Object> deviceFiltersVariables(String machineId, String search) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("machineId", machineId);
        variables.put("search", search);
        return variables;
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
