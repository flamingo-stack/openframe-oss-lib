package com.openframe.test.helpers;

import com.openframe.test.config.EnvironmentConfig;
import io.restassured.RestAssured;
import io.restassured.builder.RequestSpecBuilder;
import io.restassured.builder.ResponseSpecBuilder;
import io.restassured.config.LogConfig;
import io.restassured.config.SSLConfig;
import io.restassured.filter.log.RequestLoggingFilter;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import io.restassured.specification.ResponseSpecification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.PrintStream;

import static com.openframe.test.config.EnvironmentConfig.getAuthUrl;
import static org.hamcrest.Matchers.nullValue;

public class RequestSpecHelper {

    private static final Logger log = LoggerFactory.getLogger(RequestSpecHelper.class);
    private static final PrintStream SLF4J_STREAM = new PrintStream(new Slf4jOutputStream(log), true);

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
                                .enableLoggingOfRequestAndResponseIfValidationFails())
                        .sslConfig(SSLConfig.sslConfig().relaxedHTTPSValidation())
                        .httpClient(RetryingHttpClientFactory.config()))
                .setBaseUri(baseUri);
        if (enableLogging) {
            builder.addFilter(new RequestLoggingFilter(SLF4J_STREAM));
        }
        return builder;
    }
}
