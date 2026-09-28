package com.openframe.data.loki.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.loki.model.LokiDirection;
import com.openframe.data.loki.model.LokiLogEntry;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * {@link LokiClient} against a real Loki, the version the shared clusters run.
 */
class LokiClientIT {

    private static final GenericContainer<?> LOKI = new GenericContainer<>(DockerImageName.parse("grafana/loki:3.7.3"))
            .withExposedPorts(3100)
            .waitingFor(Wait.forHttp("/ready").forPort(3100).forStatusCode(200)
                    .withStartupTimeout(Duration.ofMinutes(2)));

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final long BASE_NANOS = toNanos(Instant.now().minus(Duration.ofMinutes(30)).truncatedTo(ChronoUnit.MILLIS));
    private static final long ONE_SECOND = 1_000_000_000L;

    private static LokiClient client;

    @BeforeAll
    static void startLoki() {
        LOKI.start();
        client = new LokiClient(RestClient.builder().baseUrl(baseUrl()).build());
    }

    @Test
    void sendsQueriesWithPlusSignsQuotesAndBracesIntact() throws Exception {
        String line = "retry a+b \"quoted\" {braces} | pipe";
        push(Map.of("job", "encoding"), List.of(entry(BASE_NANOS, line, Map.of())));

        List<LokiLogEntry> entries = awaitEntries("{job=\"encoding\"} |= " + LogQl.quote(line),
                BASE_NANOS, BASE_NANOS + 1, LokiDirection.BACKWARD, 1);

        assertThat(entries).extracting(LokiLogEntry::line).containsExactly(line);
    }

    @Test
    void mergesStreamsInTimestampOrderAndCarriesStructuredMetadata() throws Exception {
        long start = BASE_NANOS + ONE_SECOND;
        push(Map.of("job", "merge", "level", "INFO"), List.of(
                entry(start, "first", Map.of("machine_id", "m-1")),
                entry(start + 2, "third", Map.of("machine_id", "m-1"))));
        push(Map.of("job", "merge", "level", "ERROR"), List.of(
                entry(start + 1, "second", Map.of("machine_id", "m-1"))));

        List<LokiLogEntry> backward = awaitEntries("{job=\"merge\"}", start, start + 3, LokiDirection.BACKWARD, 3);
        List<LokiLogEntry> forward = client.queryRange("{job=\"merge\"}", start, start + 3, 10, LokiDirection.FORWARD);

        assertThat(backward).extracting(LokiLogEntry::line).containsExactly("third", "second", "first");
        assertThat(forward).extracting(LokiLogEntry::line).containsExactly("first", "second", "third");
        assertThat(backward.get(1).labels()).containsEntry("level", "ERROR").containsEntry("machine_id", "m-1");
        assertThat(backward.get(1).timestampNanos()).isEqualTo(start + 1);
    }

    @Test
    void includesTheStartTimestampAndExcludesTheEndTimestamp() throws Exception {
        // DeviceLogService's cursor depends on this: it ends the next page's query 1 ns after the cursor
        long start = BASE_NANOS + 2 * ONE_SECOND;
        push(Map.of("job", "bounds"), List.of(
                entry(start, "at-start", Map.of()),
                entry(start + 1, "middle", Map.of()),
                entry(start + 2, "at-end", Map.of())));
        awaitEntries("{job=\"bounds\"}", start, start + 3, LokiDirection.BACKWARD, 3);

        List<LokiLogEntry> entries = client.queryRange("{job=\"bounds\"}", start, start + 2, 10, LokiDirection.BACKWARD);

        assertThat(entries).extracting(LokiLogEntry::line).containsExactly("middle", "at-start");
    }

    @Test
    void wrapsRejectedQueriesInLokiQueryException() {
        assertThatThrownBy(() -> client.queryRange("{job=", BASE_NANOS, BASE_NANOS + 1, 1, LokiDirection.BACKWARD))
                .isInstanceOf(LokiQueryException.class)
                .hasMessageContaining("HTTP 400");
    }

    private static List<LokiLogEntry> awaitEntries(String query, long startNanos, long endNanos,
                                                   LokiDirection direction, int expected) throws InterruptedException {
        List<LokiLogEntry> entries = List.of();
        for (int attempt = 0; attempt < 50; attempt++) {
            entries = client.queryRange(query, startNanos, endNanos, 100, direction);
            if (entries.size() >= expected) {
                break;
            }
            Thread.sleep(200);
        }
        return entries;
    }

    private static List<Object> entry(long timestampNanos, String line, Map<String, String> metadata) {
        String timestamp = String.valueOf(timestampNanos);
        return metadata.isEmpty() ? List.of(timestamp, line) : List.of(timestamp, line, metadata);
    }

    private static void push(Map<String, String> labels, List<List<Object>> values) throws Exception {
        String body = JSON.writeValueAsString(Map.of("streams", List.of(Map.of("stream", labels, "values", values))));
        HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl() + "/loki/api/v1/push"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(response.body()).isEqualTo(204);
    }

    private static String baseUrl() {
        return "http://" + LOKI.getHost() + ":" + LOKI.getMappedPort(3100);
    }

    private static long toNanos(Instant instant) {
        return instant.getEpochSecond() * ONE_SECOND + instant.getNano();
    }
}
