package com.openframe.test.api;

import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.remoteaccess.DeviceRemoteAccess;
import com.openframe.test.data.dto.remoteaccess.OrganizationRemoteAccessPolicy;
import com.openframe.test.data.dto.remoteaccess.OrganizationRemoteAccessPolicyPayload;
import io.restassured.response.Response;
import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.DeviceQueries.DEVICE_REMOTE_ACCESS;
import static com.openframe.test.api.graphql.RemoteAccessQueries.ORGANIZATION_REMOTE_ACCESS_POLICY;
import static com.openframe.test.api.graphql.RemoteAccessQueries.SET_DEVICE_REMOTE_ACCESS_MODE;
import static com.openframe.test.api.graphql.RemoteAccessQueries.SET_ORGANIZATION_REMOTE_ACCESS_MODE;
import static com.openframe.test.api.graphql.RemoteAccessQueries.SET_TENANT_REMOTE_ACCESS_MODE;
import static com.openframe.test.api.graphql.RemoteAccessQueries.TENANT_REMOTE_ACCESS_POLICY;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

/**
 * The tenant's remote-access mode — what a technician has to do before a session opens.
 *
 * <p>{@code APPROVAL_REQUIRED} (the code default) parks the session until the end user accepts on the
 * device. {@code SILENT_ACCESS} opens it immediately. A test driving Remote Desktop, Remote Shell or the
 * File Manager has nobody at the keyboard, so it needs the latter.
 */
@Slf4j
public class RemoteAccessPolicyApi {

    public static final String SILENT_ACCESS = "SILENT_ACCESS";
    public static final String APPROVAL_REQUIRED = "APPROVAL_REQUIRED";
    public static final String NOTIFY_ONLY = "NOTIFY_ONLY";

    /** The tenant's current mode. */
    public static String getTenantMode() {
        return given(getAuthorizedSpec())
                .body(Map.of("query", TENANT_REMOTE_ACCESS_POLICY))
                .post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getString("data.remoteAccessPolicy.mode");
    }

    /**
     * Sets the tenant mode and returns what it was, so a caller can put it back.
     *
     * <p>Refusals arrive as {@code userErrors} rather than a GraphQL error — REMOTE_ACCESS_DISABLED is
     * the one that matters here — so they are raised explicitly instead of passing silently through the
     * success spec.
     */
    public static String setTenantMode(String mode) {
        String previous = getTenantMode();
        List<Map<String, String>> userErrors = given(getAuthorizedSpec())
                .body(Map.of("query", SET_TENANT_REMOTE_ACCESS_MODE, "variables", Map.of("mode", mode)))
                .post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getList("data.setTenantRemoteAccessMode.userErrors");
        if (userErrors != null && !userErrors.isEmpty()) {
            throw new AssertionError("setTenantRemoteAccessMode(" + mode + ") returned userErrors: " + userErrors);
        }
        log.info("Tenant remote-access mode {} -> {}", previous, mode);
        return previous;
    }

    // organizationRemoteAccessPolicy for a raw organizationId; an unknown one is a GraphQL error, so use the raw form for that.
    public static OrganizationRemoteAccessPolicy getOrganizationPolicy(String organizationId) {
        return getOrganizationPolicyRaw(organizationId)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.organizationRemoteAccessPolicy", OrganizationRemoteAccessPolicy.class);
    }

    public static Response getOrganizationPolicyRaw(String organizationId) {
        return given(getAuthorizedSpec())
                .body(Map.of("query", ORGANIZATION_REMOTE_ACCESS_POLICY, "variables", Map.of("organizationId", organizationId)))
                .post(GRAPHQL);
    }

    // Sets the organization override, or clears it with a null mode; refusals stay in userErrors for the caller to assert.
    public static OrganizationRemoteAccessPolicyPayload setOrganizationMode(String organizationId, String mode) {
        return setOrganizationModeRaw(organizationId, mode)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.setOrganizationRemoteAccessMode", OrganizationRemoteAccessPolicyPayload.class);
    }

    public static Response setOrganizationModeRaw(String organizationId, String mode) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("organizationId", organizationId);
        variables.put("mode", mode);
        return given(getAuthorizedSpec())
                .body(Map.of("query", SET_ORGANIZATION_REMOTE_ACCESS_MODE, "variables", variables))
                .post(GRAPHQL);
    }

    // Machine.remoteAccess of one device, by raw machineId.
    public static DeviceRemoteAccess getDeviceRemoteAccess(String machineId) {
        return given(getAuthorizedSpec())
                .body(Map.of("query", DEVICE_REMOTE_ACCESS, "variables", Map.of("machineId", machineId)))
                .post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.device.remoteAccess", DeviceRemoteAccess.class);
    }

    // Sets the device override, or clears it with a null mode; returns the device with its re-resolved remoteAccess.
    public static Machine setDeviceMode(String machineId, String mode) {
        return setDeviceModeRaw(machineId, mode)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.setDeviceRemoteAccessMode", Machine.class);
    }

    // Raw form: refusals arrive as GraphQL errors with extensions.code, and teardown must not throw.
    public static Response setDeviceModeRaw(String machineId, String mode) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("machineId", machineId);
        variables.put("mode", mode);
        return given(getAuthorizedSpec())
                .body(Map.of("query", SET_DEVICE_REMOTE_ACCESS_MODE, "variables", variables))
                .post(GRAPHQL);
    }
}
