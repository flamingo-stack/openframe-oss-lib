package com.openframe.test.api.auth;

import com.openframe.test.api.TenantApi;
import com.openframe.test.data.dto.auth.AuthParts;
import com.openframe.test.data.dto.user.User;
import com.openframe.test.util.StringUtils;
import io.restassured.response.Response;
import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.Map;

import static com.openframe.test.api.AuthApi.*;
import static com.openframe.test.data.generator.AuthGenerator.generateAuthParts;

@Slf4j
public class AuthFlowOSS implements IAuthFlow {

    private static final String DISCOVER = "sas/tenant/discover";

    private User user;
    private AuthParts authParts;

    public AuthFlowOSS(User user) {
        this.user = user;
    }

    public AuthFlowOSS discoverTenant() {
        String tenantId = TenantApi.discoverTenant(user);
        authParts = generateAuthParts(user, tenantId);
        return this;
    }

    public AuthFlowOSS startFlow() {
        Response response = startOAuthFlow(authParts);
        response.then().statusCode(302);
        String location = response.getHeader("Location");
        String serverState = StringUtils.extractQueryParam(location, "state");
        String serverCodeChallenge = StringUtils.extractQueryParam(location, "code_challenge");
        Map<String, String> cookies = new HashMap<>(response.getCookies());
        authParts.setState(serverState);
        authParts.setCodeChallenge(serverCodeChallenge);
        authParts.setCookies(cookies);
        return this;
    }

    public AuthFlowOSS initAuth() {
        Response response = initiateAuthorization(authParts);
        response.then().statusCode(302);
        Map<String, String> newCookies = response.getCookies();
        authParts.getCookies().putAll(newCookies);
        return this;
    }

    public AuthFlowOSS postCredentials() {
        Response response = submitCredentials(authParts);
        response.then().statusCode(302);
        Map<String, String> newCookies = response.getCookies();
        authParts.getCookies().putAll(newCookies);
        return this;
    }

    public AuthFlowOSS getAuthCode() {
        Response response = getAuthorizationCode(authParts);
        response.then().statusCode(302);
        String location = response.getHeader("Location");
        String authorizationCode = StringUtils.extractQueryParam(location, "code");
        authParts.setAuthorizationCode(authorizationCode);
        return this;
    }

    public Map<String, String> extractTokens() {
        Response response = exchangeCodeForTokens(authParts);
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
