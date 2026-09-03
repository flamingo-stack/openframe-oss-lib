package com.openframe.test.helpers;

import com.openframe.test.config.EnvironmentConfig;
import com.openframe.test.config.ExternalApiConfig;
import io.restassured.RestAssured;
import io.restassured.builder.RequestSpecBuilder;
import io.restassured.builder.ResponseSpecBuilder;
import io.restassured.config.LogConfig;
import io.restassured.config.SSLConfig;
import io.restassured.filter.log.LogDetail;
import io.restassured.filter.log.RequestLoggingFilter;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import io.restassured.specification.ResponseSpecification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.PrintStream;
import java.util.Set;

import static com.openframe.test.config.EnvironmentConfig.EXTERNAL_API;
import static com.openframe.test.config.EnvironmentConfig.getAuthUrl;
import static org.hamcrest.Matchers.nullValue;

public class RequestSpecHelper {

    private static final Logger log = LoggerFactory.getLogger(RequestSpecHelper.class);
    private static final PrintStream SLF4J_STREAM = new PrintStream(new Slf4jOutputStream(log), true);

    /** Gateway header carrying the External API key; stripped by the gateway before the service sees it. */
    private static final String X_API_KEY = "X-API-Key";
    /** Headers whose values are secrets and must never reach the console or the Slack run report. */
    private static final Set<String> BLACKLISTED_HEADERS = Set.of(X_API_KEY);

    private static final ThreadLocal<String> baseUrl = new ThreadLocal<>();
    private static final ThreadLocal<String> bearerToken = new ThreadLocal<>();
    private static Boolean enableLogging = true;

    public static void setBaseUrl(String url) {
        baseUrl.set(url);
    }

    public static String getBaseUrl() {
        return baseUrl.get() != null ? baseUrl.get() : EnvironmentConfig.getBaseUrl();
    }

    public static void setEnableLogging(boolean enabled) {
        enableLogging = enabled;
    }

    public static ResponseSpecification graphqlSuccess() {
        return new ResponseSpecBuilder()
                .expectStatusCode(200)
                .expectBody("errors", nullValue())
                .build();
    }

    /**
     * Makes a bearer token the authenticated actor for this thread, instead of the cookie-based ADMIN
     * session the rest of the suite runs as. Every {@code api/*} call goes through
     * {@link #getAuthorizedSpec()}, so this one switch is what lets the whole API layer be reused
     * unchanged as an AGENT (the client/Fae surface) — no parallel set of request methods.
     * <p>
     * Always paired with {@link #clearBearerToken()}; {@code AgentSession} owns that pairing. While a
     * token is installed, {@link AuthHelper#getCookies()} is never consulted, so no ADMIN login is
     * triggered on this thread.
     */
    public static void setBearerToken(String token) {
        bearerToken.set(token);
    }

    /** Reverts to the cookie-based ADMIN actor for this thread. */
    public static void clearBearerToken() {
        bearerToken.remove();
    }

    /** {@code true} while this thread is acting as a bearer-token actor rather than the ADMIN session. */
    public static boolean hasBearerToken() {
        return bearerToken.get() != null;
    }

    public static RequestSpecification getAuthorizedSpec() {
        String token = bearerToken.get();
        if (token != null) {
            return prebuildRequestSpec()
                    .addHeader("Authorization", "Bearer " + token)
                    .build();
        }
        return prebuildRequestSpec()
                .addCookies(AuthHelper.getCookies())
                .build();
    }

    public static RequestSpecification getUnAuthorizedSpec() {
        return prebuildRequestSpec().build();
    }

    /**
     * Unauthenticated JSON spec pointed at the apex auth host ({@code getAuthUrl()}), not the tenant
     * subdomain. The SAS invitation-accept endpoint ({@code /sas/invitations/accept}) is served only on
     * the apex; posting it to the tenant subdomain 404s.
     */
    public static RequestSpecification getUnAuthorizedAuthSpec() {
        return baseRequestSpec(getAuthUrl())
                .setContentType(ContentType.JSON)
                .build();
    }

    /**
     * Spec for the External API ({@code /external-api/**}), authenticated with the configured
     * {@code X-API-Key}.
     *
     * <p>This is a third actor alongside the ADMIN cookie session and the AGENT bearer token, and it is
     * deliberately kept off {@link #getAuthorizedSpec()}: the External API is a separate contract on a
     * separate base path, and a test must never silently fall back to admin credentials when the key is
     * missing.
     */
    public static RequestSpecification getExternalApiSpec() {
        return externalApiSpec().addHeader(X_API_KEY, ExternalApiConfig.getApiKey()).build();
    }

    /**
     * Same, with an explicit key — for negative cases (malformed, revoked, or another tenant's key)
     * that must not disturb the configured one.
     */
    public static RequestSpecification getExternalApiSpec(String apiKey) {
        return externalApiSpec().addHeader(X_API_KEY, apiKey).build();
    }

    /** External API base with no {@code X-API-Key} at all; the gateway answers 401. */
    public static RequestSpecification getExternalApiSpecNoKey() {
        return externalApiSpec().build();
    }

    /**
     * Base URI is the tenant host plus the {@code /external-api} gateway prefix, so facades pass the
     * bare swagger path ({@code api/v1/tickets}) exactly as documented.
     *
     * <p>Carries {@link RateLimitRetryFilter}, without which any suite longer than the key's per-minute
     * budget fails on 429 rather than on anything it meant to assert, and
     * {@link TransientGatewayRetryFilter} for the gateway blips this environment produces.
     */
    private static RequestSpecBuilder externalApiSpec() {
        return baseRequestSpec(getBaseUrl() + EXTERNAL_API + "/")
                .setContentType(ContentType.JSON)
                .addFilter(new RateLimitRetryFilter())
                .addFilter(new TransientGatewayRetryFilter());
    }

    private static RequestSpecBuilder prebuildRequestSpec() {
        return baseRequestSpec(getBaseUrl())
                .setContentType(ContentType.JSON);
    }

    public static RequestSpecification getAuthFlowRequestSpec() {
        return baseRequestSpec(getAuthUrl()).build();
    }

    private static RequestSpecBuilder baseRequestSpec(String baseUri) {
        RequestSpecBuilder builder = new RequestSpecBuilder()
                .setConfig(RestAssured.config()
                        .logConfig(LogConfig.logConfig()
                                .defaultStream(SLF4J_STREAM)
                                // The External API key is a bearer secret in a header the request logger
                                // would otherwise print in full, into both the console and the Slack run
                                // report. Blacklisting substitutes the value, keeping the header visible.
                                .blacklistHeaders(BLACKLISTED_HEADERS)
                                .enableLoggingOfRequestAndResponseIfValidationFails())
                        .sslConfig(SSLConfig.sslConfig().relaxedHTTPSValidation())
                        .httpClient(RetryingHttpClientFactory.config()))
                .setBaseUri(baseUri);
        if (enableLogging) {
            // RequestLoggingFilter takes its blacklist as a constructor argument rather than reading the
            // LogConfig one, so the header must be named here too or the key is printed in full.
            builder.addFilter(new RequestLoggingFilter(LogDetail.ALL, true, SLF4J_STREAM, true, BLACKLISTED_HEADERS));
        }
        return builder;
    }
}
