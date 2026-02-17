package com.openframe.test.helpers;

import io.restassured.RestAssured;
import io.restassured.builder.RequestSpecBuilder;
import io.restassured.config.HttpClientConfig;
import io.restassured.config.LogConfig;
import io.restassured.config.SSLConfig;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;

import java.time.Duration;

import static com.openframe.test.config.EnvironmentConfig.getAuthUrl;
import com.openframe.test.config.EnvironmentConfig;
import static com.openframe.test.helpers.AuthHelper.getCookies;

public class RequestSpecHelper {

    private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(30);
    private static final ThreadLocal<String> baseUrl = new ThreadLocal<>();

    public static void setBaseUrl(String url) {
        baseUrl.set(url);
    }

    public static String getBaseUrl() {
        return baseUrl.get() != null ? baseUrl.get() : EnvironmentConfig.getBaseUrl();
    }

    public static RequestSpecification getAuthorizedSpec() {
        return prebuildRequestSpec()
                .addCookies(getCookies())
                .build();
    }

    public static RequestSpecification getUnAuthorizedSpec() {
        return prebuildRequestSpec().build();
    }

    private static RequestSpecBuilder prebuildRequestSpec() {
        return new RequestSpecBuilder()
                .setConfig(RestAssured.config()
                        .logConfig(LogConfig.logConfig().enableLoggingOfRequestAndResponseIfValidationFails())
                        .sslConfig(SSLConfig.sslConfig().relaxedHTTPSValidation())
                        .httpClient(HttpClientConfig.httpClientConfig()
                                .setParam("http.connection.timeout", (int) DEFAULT_TIMEOUT.toMillis())
                                .setParam("http.socket.timeout", (int) DEFAULT_TIMEOUT.toMillis())))
                .setBaseUri(getBaseUrl())
                .setContentType(ContentType.JSON);
    }

    public static RequestSpecification getAuthFlowRequestSpec() {
        return new RequestSpecBuilder()
                .setConfig(RestAssured.config()
                        .logConfig(LogConfig.logConfig().enableLoggingOfRequestAndResponseIfValidationFails())
                        .sslConfig(SSLConfig.sslConfig().relaxedHTTPSValidation())
                        .httpClient(HttpClientConfig.httpClientConfig()
                                .setParam("http.connection.timeout", (int) DEFAULT_TIMEOUT.toMillis())
                                .setParam("http.socket.timeout", (int) DEFAULT_TIMEOUT.toMillis())))
                .setBaseUri(getAuthUrl())
                .build();
    }
}
