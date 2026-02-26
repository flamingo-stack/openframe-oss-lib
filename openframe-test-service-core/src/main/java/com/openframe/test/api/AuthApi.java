package com.openframe.test.api;

import com.openframe.test.data.dto.auth.AuthParts;
import com.openframe.test.data.dto.user.User;
import io.restassured.response.Response;

import java.util.HashMap;
import java.util.Map;

import static com.openframe.test.config.EnvironmentConfig.DEFAULT_BASE_URL;
import static com.openframe.test.config.EnvironmentConfig.getBaseUrl;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthFlowRequestSpec;
import static com.openframe.test.helpers.RequestSpecHelper.getUnAuthorizedSpec;
import static io.restassured.RestAssured.given;

public class AuthApi {

    private static final String OAUTH_LOGIN = "oauth/login";
    private static final String OAUTH_REFRESH = "oauth/refresh";
    private static final String OAUTH_LOGOUT = "oauth/logout";
    private static final String REDIRECT_TO_DASHBOARD = "dashboard";
    private static final String OAUTH_CALLBACK = "oauth/callback";
    private static final String OAUTH2_AUTHORIZE = "sas/%s/oauth2/authorize";
    private static final String CLIENT_ID = "openframe-gateway";
    private static final String SAS_LOGIN = "sas/login";

    public static Response startOAuthFlow(AuthParts authParts) {
        Map<String, String> queryParams = Map.of(
                "tenantId", authParts.getTenantId(),
                "redirectTo", getBaseUrl().concat(REDIRECT_TO_DASHBOARD));
        return given(getAuthFlowRequestSpec())
                .queryParams(queryParams)
                .redirects().follow(false)
                .when()
                .get(OAUTH_LOGIN);
    }

    public static Response initiateAuthorization(AuthParts authParts) {
        Map<String, Object> queryParams = getAuthQueryParams(authParts);
        return given(getAuthFlowRequestSpec())
                .cookies(authParts.getCookies())
                .queryParams(queryParams)
                .redirects().follow(false)
                .when()
                .get(OAUTH2_AUTHORIZE.formatted(authParts.getTenantId()));
    }

    public static Response submitCredentials(AuthParts authParts) {
        Map<String, Object> formParams = Map.of(
                "username", authParts.getEmail(),
                "password", authParts.getPassword());
        return given(getAuthFlowRequestSpec())
                .baseUri(DEFAULT_BASE_URL)
                .cookie("JSESSIONID", authParts.getCookies().get("JSESSIONID"))
                .formParams(formParams)
                .redirects().follow(false)
                .when()
                .post(SAS_LOGIN);
    }

    public static Response getAuthorizationCode(AuthParts authParts) {
        Map<String, Object> queryParams = getAuthQueryParams(authParts);
        queryParams.put("continue", "");
        return given(getAuthFlowRequestSpec())
                .cookies(authParts.getCookies())
                .queryParams(queryParams)
                .redirects().follow(false)
                .when()
                .get(OAUTH2_AUTHORIZE.formatted(authParts.getTenantId()));
    }

    public static Response exchangeCodeForTokens(AuthParts authParts) {
        Map<String, String> queryParams = Map.of(
                "code", authParts.getAuthorizationCode(),
                "state", authParts.getState());
        return given(getAuthFlowRequestSpec())
                .cookies(authParts.getCookies())
                .queryParams(queryParams)
                .redirects().follow(false)
                .when()
                .get(OAUTH_CALLBACK);
    }

    public static Map<String, String> refresh(String tenantId, Map<String, String> cookies) {
        return given(getUnAuthorizedSpec())
                .cookie("refresh_token", cookies.get("refresh_token"))
                .queryParam("tenantId", tenantId)
                .when()
                .post(OAUTH_REFRESH)
                .then()
                .statusCode(204)
                .extract().response().getCookies();
    }

    public static Map<String, String> refresh(Map<String, String> cookies) {
        return given(getUnAuthorizedSpec())
                .cookie("refresh_token", cookies.get("refresh_token"))
                .when()
                .post(OAUTH_REFRESH)
                .then()
                .statusCode(204)
                .extract().response().getCookies();
    }

    public static Response attemptRefresh(User user, Map<String, String> cookies) {
        return given(getUnAuthorizedSpec())
                .cookie("refresh_token", cookies.get("refresh_token"))
//                .queryParam("tenantId", user.getTenantId())
                .when()
                .post(OAUTH_REFRESH);
//                .then()
//                .statusCode(204)
//                .extract().response().getCookies();
    }

    public static Map<String, String> logout(String tenantId, Map<String, String> cookies) {
        return given(getUnAuthorizedSpec())
                .cookie("refresh_token", cookies.get("refresh_token"))
                .queryParam("tenantId", tenantId)
                .get(OAUTH_LOGOUT)
                .then().statusCode(204)
                .extract().response().getCookies();
    }

    public static Map<String, String> logout(Map<String, String> cookies) {
        return given(getUnAuthorizedSpec())
                .cookie("refresh_token", cookies.get("refresh_token"))
                .get(OAUTH_LOGOUT)
                .then().statusCode(204)
                .extract().response().getCookies();
    }

    private static Map<String, Object> getAuthQueryParams(AuthParts authParts) {
        Map<String, Object> queryParams = new HashMap<>();
        queryParams.put("response_type", "code");
        queryParams.put("client_id", CLIENT_ID);
        queryParams.put("code_challenge", authParts.getCodeChallenge());
        queryParams.put("code_challenge_method", "S256");
        queryParams.put("redirect_uri", DEFAULT_BASE_URL.concat(OAUTH_CALLBACK));
        queryParams.put("scope", "openid profile email offline_access");
        queryParams.put("state", authParts.getState());
        return queryParams;
    }
}
