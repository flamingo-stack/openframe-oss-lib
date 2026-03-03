package com.openframe.test.helpers;

import com.openframe.test.config.EnvironmentConfig;
import io.restassured.RestAssured;
import io.restassured.builder.RequestSpecBuilder;
import io.restassured.config.HttpClientConfig;
import io.restassured.config.LogConfig;
import io.restassured.config.SSLConfig;
import io.restassured.filter.log.RequestLoggingFilter;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.OutputStream;
import java.io.PrintStream;
import java.time.Duration;

import static com.openframe.test.config.EnvironmentConfig.getAuthUrl;
import static com.openframe.test.helpers.AuthHelper.getCookies;

public class RequestSpecHelper {

    private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(10);
    private static final Logger log = LoggerFactory.getLogger(RequestSpecHelper.class);
    private static final PrintStream SLF4J_STREAM = new PrintStream(new Slf4jOutputStream(log), true);

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
                        .logConfig(LogConfig.logConfig()
                                .defaultStream(SLF4J_STREAM)
                                .enableLoggingOfRequestAndResponseIfValidationFails())
                        .sslConfig(SSLConfig.sslConfig().relaxedHTTPSValidation())
                        .httpClient(HttpClientConfig.httpClientConfig()
                                .setParam("http.connection.timeout", (int) DEFAULT_TIMEOUT.toMillis())
                                .setParam("http.socket.timeout", (int) DEFAULT_TIMEOUT.toMillis())))
                .setBaseUri(getBaseUrl())
                .addFilter(new RequestLoggingFilter(SLF4J_STREAM))
                .setContentType(ContentType.JSON);
    }

    public static RequestSpecification getAuthFlowRequestSpec() {
        return new RequestSpecBuilder()
                .setConfig(RestAssured.config()
                        .logConfig(LogConfig.logConfig()
                                .defaultStream(SLF4J_STREAM)
                                .enableLoggingOfRequestAndResponseIfValidationFails())
                        .sslConfig(SSLConfig.sslConfig().relaxedHTTPSValidation())
                        .httpClient(HttpClientConfig.httpClientConfig()
                                .setParam("http.connection.timeout", (int) DEFAULT_TIMEOUT.toMillis())
                                .setParam("http.socket.timeout", (int) DEFAULT_TIMEOUT.toMillis())))
                .setBaseUri(getAuthUrl())
                .addFilter(new RequestLoggingFilter(SLF4J_STREAM))
                .build();
    }

    private static class Slf4jOutputStream extends OutputStream {
        private final Logger logger;
        private final StringBuilder buffer = new StringBuilder();

        Slf4jOutputStream(Logger logger) {
            this.logger = logger;
        }

        @Override
        public void write(int b) {
            if (b == '\n') {
                flushLine();
            } else {
                buffer.append((char) b);
            }
        }

        @Override
        public void write(byte[] b, int off, int len) {
            for (int i = off; i < off + len; i++) {
                write(b[i]);
            }
        }

        @Override
        public void flush() {
            if (!buffer.isEmpty()) {
                flushLine();
            }
        }

        private void flushLine() {
            String line = buffer.toString();
            buffer.setLength(0);
            if (!line.isBlank()) {
                logger.info(line);
            }
        }
    }
}
