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

    public static RequestSpecification getAuthorizedSpec() {
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
