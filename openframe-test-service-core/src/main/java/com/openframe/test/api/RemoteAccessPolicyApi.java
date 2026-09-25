package com.openframe.test.api;

import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Map;

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
}
