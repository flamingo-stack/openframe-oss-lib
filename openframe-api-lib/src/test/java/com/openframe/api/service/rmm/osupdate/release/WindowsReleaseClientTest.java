package com.openframe.api.service.rmm.osupdate.release;

import com.sun.net.httpserver.HttpServer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class WindowsReleaseClientTest {

    private static final String PATH = "/api/windows.json";
    private static final String SOURCE_FAILED = "openframe.rmm.os_update.os_versions.source_failed";
    private static final String ANSWER = "[{\"cycle\": \"11-24h2-w\", \"latest\": \"10.0.26100\", \"eol\": \"2026-10-13\"}]";

    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    private final AtomicInteger requests = new AtomicInteger();
    private volatile int status = 200;
    private HttpServer httpServer;
    private WindowsReleaseClient windowsReleaseClient;

    @BeforeEach
    void startTheSource() throws IOException {
        httpServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        httpServer.createContext(PATH, exchange -> {
            requests.incrementAndGet();
            byte[] body = ANSWER.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, body.length);
            try (OutputStream responseBody = exchange.getResponseBody()) {
                responseBody.write(body);
            }
        });
        httpServer.start();
        String baseUrl = "http://127.0.0.1:" + httpServer.getAddress().getPort();
        windowsReleaseClient = new WindowsReleaseClient(new WindowsReleaseParser(JsonMapper.builder().build()),
                new WindowsReleaseMetrics(meterRegistry), baseUrl, PATH, Duration.ofSeconds(5), Duration.ofHours(6));
    }

    @AfterEach
    void stopTheSource() {
        httpServer.stop(0);
    }

    @Test
    void listWindowsReleases_twice_readOnceFromTheSource() {
        // setup

        // execution
        List<WindowsRelease> first = windowsReleaseClient.listWindowsReleases();
        List<WindowsRelease> second = windowsReleaseClient.listWindowsReleases();

        // verifications
        assertThat(first).extracting(WindowsRelease::getLatestBuild).containsExactly("26100");
        assertThat(second).isEqualTo(first);
        assertThat(requests).hasValue(1);
        assertThat(meterRegistry.find(SOURCE_FAILED).counter()).isNull();
    }

    @Test
    void listWindowsReleases_sourceFails_emptyCountedAndTheNextCallAsksAgain() {
        // setup
        status = 503;

        // execution
        List<WindowsRelease> whileDown = windowsReleaseClient.listWindowsReleases();
        status = 200;
        List<WindowsRelease> afterRecovery = windowsReleaseClient.listWindowsReleases();

        // verifications
        assertThat(whileDown).isEmpty();
        assertThat(afterRecovery).hasSize(1);
        assertThat(requests).hasValue(2);
        assertThat(meterRegistry.get(SOURCE_FAILED).tag("source", "endoflife").counter().count()).isEqualTo(1.0);
    }

    @Test
    void listWindowsReleases_sourceUnreachable_emptyAndCounted() {
        // setup
        httpServer.stop(0);

        // execution
        List<WindowsRelease> windowsReleases = windowsReleaseClient.listWindowsReleases();

        // verifications
        assertThat(windowsReleases).isEmpty();
        assertThat(meterRegistry.get(SOURCE_FAILED).counter().count()).isEqualTo(1.0);
    }
}
