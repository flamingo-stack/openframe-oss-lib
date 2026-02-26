package com.openframe.test.api.auth;

import com.openframe.test.api.TenantApi;
import com.openframe.test.data.dto.user.User;
import io.restassured.response.Response;
import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.Map;

import static com.openframe.test.config.EnvironmentConfig.getAuthUrl;
import static io.restassured.RestAssured.given;

@Slf4j
public class AuthFlowSAAS implements IAuthFlow {

    private static final String OAUTH_LOGIN = "oauth/login";

    private final User user;
    private String tenantId;
    private String nextLocation;
    private final Map<String, String> allCookies = new HashMap<>();

    public AuthFlowSAAS(User user) {
        this.user = user;
    }

    public AuthFlowSAAS discoverTenant() {
        tenantId = TenantApi.discoverTenant(user);
        return this;
    }

    public AuthFlowSAAS startFlow() {
        Map<String, String> queryParams = Map.of(
                "tenantId", tenantId);
        Response response = given()
                .baseUri(getAuthUrl())
                .queryParams(queryParams)
                .redirects().follow(false)
                .get(OAUTH_LOGIN);
        response.then().statusCode(302);
        nextLocation = response.getHeader("Location");
        allCookies.putAll(response.getCookies());
        return this;
    }

    public AuthFlowSAAS initAuth() {
        Response response = given()
                .urlEncodingEnabled(false)
                .redirects().follow(false)
                .get(nextLocation);
        response.then().statusCode(302);
        nextLocation = response.getHeader("Location");
        allCookies.putAll(response.getCookies());
        return this;
    }

    public AuthFlowSAAS postCredentials() {
        Map<String, Object> formParams = Map.of(
                "username", user.getEmail(),
                "password", user.getPassword());
        Response response = given()
                .urlEncodingEnabled(false)
                .cookie("JSESSIONID", allCookies.get("JSESSIONID"))
                .formParams(formParams)
                .redirects().follow(false)
                .post(nextLocation);
        response.then().statusCode(302);
        nextLocation = response.getHeader("Location");
        allCookies.putAll(response.getCookies());
        return this;
    }

    public AuthFlowSAAS getAuthCode() {
        Response response = given()
                .urlEncodingEnabled(false)
                .cookie("JSESSIONID", allCookies.get("JSESSIONID"))
                .redirects().follow(false)
                .get(nextLocation);
        response.then().statusCode(302);
        nextLocation = response.getHeader("Location");
        return this;
    }

    public Map<String, String> extractTokens() {
        Response response = given()
                .urlEncodingEnabled(false)
                .cookies(allCookies)
                .redirects().follow(false)
                .get(nextLocation);
        response.then().statusCode(302);
        Map<String, String> responseCookies = response.getCookies();
        Map<String, String> cookies = new HashMap<>();
        if (responseCookies.containsKey("access_token")) {
            cookies.put("access_token", responseCookies.get("access_token"));
        }
        if (responseCookies.containsKey("refresh_token")) {
            cookies.put("refresh_token", responseCookies.get("refresh_token"));
        }
        return cookies;
    }
}
