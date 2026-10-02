package com.openframe.data.loki.config;

import com.openframe.data.loki.client.LokiClient;
import com.openframe.data.loki.client.LokiQueryException;
import com.openframe.data.loki.toolevent.ToolEventLog;
import com.openframe.data.loki.toolevent.ToolEventLogRepository;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.SocketTimeoutException;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LokiConfigTest {

    private static final String EMPTY_RESULT = "{\"status\":\"success\",\"data\":{\"resultType\":\"streams\",\"result\":[]}}";
    private static final Instant TIMESTAMP = Instant.parse("2026-10-01T10:00:00.123Z");

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(LokiConfig.class);
    private final List<String> received = new CopyOnWriteArrayList<>();
    private final CountDownLatch lokiMayAnswer = new CountDownLatch(1);

    private HttpServer loki;

    @BeforeEach
    void startLoki() throws IOException {
        loki = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        loki.start();
    }

    @AfterEach
    void stopLoki() {
        lokiMayAnswer.countDown();
        loki.stop(0);
    }

    @Test
    void toolEventLogRepository_lokiEnabled_savesThroughTheClientOnTheConfiguredUrl() {
        loki.createContext("/loki/api/v1/push", exchange -> {
            received.add(new String(exchange.getRequestBody().readAllBytes(), UTF_8));
            answerSaved(exchange);
        });

        enabledContext().run(context -> context.getBean(ToolEventLogRepository.class).save(event()));

        assertThat(received)
                .singleElement()
                .asString()
                .contains("\"tenant_id\":\"tenant-a\"", "\"tool_event_id\":\"evt-1\"");
    }

    @Test
    void lokiClient_byteCapConfigured_sendsItWithEveryQuery() {
        loki.createContext("/loki/api/v1/query_range", exchange -> {
            received.add(exchange.getRequestHeaders().getFirst("X-Loki-Query-Limits"));
            answerNothingFound(exchange);
        });

        enabledContext().withPropertyValues("openframe.loki.max-query-bytes-read=5GB")
                .run(context -> context.getBean(ToolEventLogRepository.class)
                        .find("tenant-a", "FLEET", "LOGIN", TIMESTAMP, "evt-1"));

        assertThat(received).containsExactly("{\"maxQueryBytesRead\":\"5GB\"}");
    }

    @Test
    void lokiClient_bootRestClientBuilderAvailable_buildsTheClientOnIt() {
        loki.createContext("/loki/api/v1/push", exchange -> {
            received.add(exchange.getRequestHeaders().getFirst("X-From-Boot-Builder"));
            answerSaved(exchange);
        });

        enabledContext().withBean(RestClient.Builder.class,
                        () -> RestClient.builder().defaultHeader("X-From-Boot-Builder", "yes"))
                .run(context -> context.getBean(ToolEventLogRepository.class).save(event()));

        assertThat(received).containsExactly("yes");
    }

    @Test
    @Timeout(5)
    void lokiClient_lokiSlowerThanTheReadTimeout_failsTheLookup() {
        loki.createContext("/loki/api/v1/query_range", exchange -> awaitRelease());

        enabledContext().withPropertyValues("openframe.loki.read-timeout=200ms")
                .run(context -> assertThatThrownBy(() -> context.getBean(ToolEventLogRepository.class)
                        .find("tenant-a", "FLEET", "LOGIN", TIMESTAMP, "evt-1"))
                        .isExactlyInstanceOf(LokiQueryException.class)
                        .hasMessageStartingWith("Loki query failed: ")
                        .hasRootCauseInstanceOf(SocketTimeoutException.class));
    }

    @Test
    void lokiConfig_switchOff_registersNeitherClientNorRepository() {
        contextRunner.withPropertyValues("openframe.loki.enabled=false", "openframe.loki.url=http://loki.test")
                .run(context -> assertThat(context)
                        .doesNotHaveBean(LokiClient.class)
                        .doesNotHaveBean(ToolEventLogRepository.class));
    }

    @Test
    void lokiConfig_switchMissing_registersNeitherClientNorRepository() {
        contextRunner.withPropertyValues("openframe.loki.url=http://loki.test")
                .run(context -> assertThat(context)
                        .doesNotHaveBean(LokiClient.class)
                        .doesNotHaveBean(ToolEventLogRepository.class));
    }

    @Test
    void lokiClient_urlMissing_failsStartupNamingTheProperty() {
        contextRunner.withPropertyValues("openframe.loki.enabled=true")
                .run(context -> assertThat(context)
                        .getFailure()
                        .hasRootCauseInstanceOf(IllegalArgumentException.class)
                        .hasRootCauseMessage("openframe.loki.url must be set when openframe.loki.enabled=true"));
    }

    private ApplicationContextRunner enabledContext() {
        return contextRunner.withPropertyValues("openframe.loki.enabled=true",
                "openframe.loki.url=http://127.0.0.1:" + loki.getAddress().getPort());
    }

    private void awaitRelease() {
        try {
            lokiMayAnswer.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static void answerSaved(HttpExchange exchange) throws IOException {
        exchange.sendResponseHeaders(204, -1);
        exchange.close();
    }

    private static void answerNothingFound(HttpExchange exchange) throws IOException {
        byte[] body = EMPTY_RESULT.getBytes(UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, body.length);
        exchange.getResponseBody().write(body);
        exchange.close();
    }

    private static ToolEventLog event() {
        return ToolEventLog.builder()
                .tenantId("tenant-a")
                .toolType("FLEET")
                .eventType("LOGIN")
                .toolEventId("evt-1")
                .eventTimestamp(TIMESTAMP.toEpochMilli())
                .build();
    }
}
