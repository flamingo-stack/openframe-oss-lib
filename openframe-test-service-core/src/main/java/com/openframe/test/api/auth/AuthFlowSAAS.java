package com.openframe.test.api.auth;

import com.openframe.test.api.TenantApi;
import com.openframe.test.data.dto.user.User;
import io.restassured.response.Response;
import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.openframe.test.config.EnvironmentConfig.getAuthUrl;
import static io.restassured.RestAssured.given;

@Slf4j
public class AuthFlowSAAS implements IAuthFlow {

    private static final String OAUTH_LOGIN = "oauth/login";

    /** Spring Security's default CSRF form parameter. */
    private static final String CSRF_PARAM = "_csrf";

    private static final Pattern CSRF_INPUT = Pattern.compile(
            "<input[^>]*name=\"_csrf\"[^>]*value=\"([^\"]*)\"[^>]*>"
                    + "|<input[^>]*value=\"([^\"]*)\"[^>]*name=\"_csrf\"[^>]*>",
            Pattern.CASE_INSENSITIVE);

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
                .relaxedHTTPSValidation()
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
                .relaxedHTTPSValidation()
                .urlEncodingEnabled(false)
                .redirects().follow(false)
                .get(nextLocation);
        response.then().statusCode(302);
        nextLocation = response.getHeader("Location");
        allCookies.putAll(response.getCookies());
        return this;
    }

    /**
     * Fetches the login page, then posts the credentials back to it with the page's CSRF token.
     * <p>
     * The GET is not optional. The authorization service enables CSRF for exactly one endpoint —
     * {@code requireCsrfProtectionMatcher(new AntPathRequestMatcher("/login", "POST"))} in
     * {@code openframe-authorization-service-core}'s {@code SecurityConfig} — and the token is delivered
     * only as a hidden {@code _csrf} input in this page's HTML, bound to the session the same response
     * carries. Posting straight to {@code nextLocation}, as this flow did before, is a flat 403 and takes
     * every test in the run down with it, since each one re-runs the whole login.
     */
    public AuthFlowSAAS postCredentials() {
        Response loginPage = given()
                .relaxedHTTPSValidation()
                .urlEncodingEnabled(false)
                .cookies(allCookies)
                .redirects().follow(false)
                .get(nextLocation);
        loginPage.then().statusCode(200);
        allCookies.putAll(loginPage.getCookies());

        Map<String, Object> formParams = new HashMap<>();
        formParams.put("username", user.getEmail());
        formParams.put("password", user.getPassword());
        String csrfToken = extractCsrfToken(loginPage.getBody().asString());
        if (csrfToken != null) {
            formParams.put(CSRF_PARAM, csrfToken);
        }
        // URL encoding stays on here, unlike the other steps: the token is base64 and may contain
        // characters that must be escaped in a form body. The POST target is the bare login URL with no
        // query string, so there is nothing else for the encoder to affect.
        Response response = given()
                .relaxedHTTPSValidation()
                .cookie("JSESSIONID", allCookies.get("JSESSIONID"))
                .formParams(formParams)
                .redirects().follow(false)
                .post(nextLocation);
        response.then().statusCode(302);
        nextLocation = response.getHeader("Location");
        allCookies.putAll(response.getCookies());
        return this;
    }

    /**
     * Pulls the {@code _csrf} value out of the login page, or returns {@code null} when the page carries
     * no such field. Attribute order is not guaranteed, so both orderings are matched.
     * <p>
     * A missing token is not an error, because the deployments are not in step: qa enforces CSRF on
     * {@code POST /login} and renders the hidden input (posting without it is the flat 403 that took down
     * all 55 tests on 2026-07-30), while stage/miami still runs a build whose login page has no such
     * input and whose {@code POST /login} accepts credentials on their own. Demanding the token would
     * simply move the outage from one environment to the other. Sending it when present and omitting it
     * when absent satisfies both, and keeps working after every environment has upgraded.
     */
    private static String extractCsrfToken(String loginPageHtml) {
        Matcher matcher = CSRF_INPUT.matcher(loginPageHtml);
        if (!matcher.find()) {
            log.info("Login page carries no _csrf input; posting credentials without one "
                    + "(pre-CSRF authorization-service build)");
            return null;
        }
        return matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
    }

    public AuthFlowSAAS getAuthCode() {
        Response response = given()
                .relaxedHTTPSValidation()
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
                .relaxedHTTPSValidation()
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
