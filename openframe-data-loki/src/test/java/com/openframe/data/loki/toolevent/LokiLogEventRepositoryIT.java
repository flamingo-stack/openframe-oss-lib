package com.openframe.data.loki.toolevent;

import com.openframe.data.loki.client.LokiClient;
import com.openframe.data.loki.client.LokiPushRejectedException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.web.client.RestClient;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.params.provider.Arguments.arguments;

class LokiLogEventRepositoryIT {

    private static final GenericContainer<?> LOKI = new GenericContainer<>(DockerImageName.parse("grafana/loki:3.7.3"))
            .withExposedPorts(3100)
            .waitingFor(Wait.forHttp("/ready").forPort(3100).forStatusCode(200)
                    .withStartupTimeout(Duration.ofMinutes(2)));

    private static final Instant MOMENT = Instant.now().minus(Duration.ofMinutes(5)).truncatedTo(ChronoUnit.MILLIS);

    private static final LokiLogEvent SAVED_FOR_EXACT_LOOKUPS =
            event("tenant-exact", "evt-1", MOMENT, "{\"ip\":\"10.0.0.1\"}");

    private static LokiClient lokiClient;
    private static LokiLogEventRepository repository;

    @BeforeAll
    static void startLokiAndSaveTheEventForExactLookups() {
        LOKI.start();
        lokiClient = new LokiClient(RestClient.builder()
                .baseUrl("http://" + LOKI.getHost() + ":" + LOKI.getMappedPort(3100))
                .build());
        repository = new LokiLogEventRepository(lokiClient);
        repository.save(SAVED_FOR_EXACT_LOOKUPS);
        awaitFound(SAVED_FOR_EXACT_LOOKUPS);
    }

    @Test
    void find_savedEvent_returnsItWithEveryField() {
        awaitFound(SAVED_FOR_EXACT_LOOKUPS);
    }

    @Test
    void save_sameEventSentAgainAfterALaterEvent_isAcceptedAndTheEventIsStillFound() {
        LokiLogEvent event = event("tenant-twice", "evt-1", MOMENT, "{\"ip\":\"10.0.0.1\"}");

        repository.save(event);
        repository.save(event("tenant-twice", "evt-2", MOMENT.plusMillis(1), "{\"ip\":\"10.0.0.2\"}"));
        repository.save(event);

        awaitFound(event);
    }

    @Test
    void find_twoEventsInTheSameMillisecond_returnsEachByItsOwnId() {
        LokiLogEvent first = event("tenant-same-milli", "evt-1", MOMENT, "{\"output\":\"first\"}");
        LokiLogEvent second = event("tenant-same-milli", "evt-2", MOMENT, "{\"output\":\"second\"}");

        repository.save(first);
        repository.save(second);

        awaitFound(first);
        awaitFound(second);
    }

    @Test
    void find_eventSavedAgainLaterWithNewDetails_returnsTheVersionOfTheAskedMoment() {
        LokiLogEvent started = event("tenant-versions", "evt-1", MOMENT, "{\"status\":\"started\"}");
        LokiLogEvent finished = event("tenant-versions", "evt-1", MOMENT.plusSeconds(1), "{\"status\":\"finished\"}");

        repository.save(started);
        repository.save(finished);

        awaitFound(started);
        awaitFound(finished);
    }

    @Test
    void find_eventIdWithQuotesBracesAndBackslash_returnsThatEvent() {
        LokiLogEvent event = event("tenant-odd-id", "evt-\"1\"{x}\\", MOMENT, "{\"ip\":\"10.0.0.1\"}");

        repository.save(event);

        awaitFound(event);
    }

    @Test
    void find_eventCopiedFromTheOldStoreIntoItsOwnStream_returnsIt() {
        LokiLogEvent copied = event("tenant-history", "evt-1", MOMENT, "{\"ip\":\"10.0.0.1\"}");
        String lineTheCopyScriptWrites = """
                {"tenantId":"tenant-history","toolType":"RMM","eventType":"SCRIPT_EXECUTED","toolEventId":"evt-1",\
                "ingestDay":"2026-10-01","eventTimestamp":%d,"severity":"INFO","message":"Script executed",\
                "details":"{\\"ip\\":\\"10.0.0.1\\"}","userId":"user-7","deviceId":"device-7","hostname":"host-7",\
                "nickname":"Reception iMac","executionSource":"MANUAL","scriptCreationSource":"AI_ASSISTANT",\
                "organizationId":"org-7","organizationName":"Acme"}""".formatted(MOMENT.toEpochMilli());

        lokiClient.push(
                Map.of("job", "tool-events", "tenant_id", "tenant-history", "tool_type", "RMM", "origin", "cassandra"),
                MOMENT.toEpochMilli() * 1_000_000, lineTheCopyScriptWrites,
                Map.of("tool_event_id", "evt-1"));

        awaitFound(copied);
        assertThat(repository.toLine(copied)).isEqualTo(lineTheCopyScriptWrites);
    }

    @ParameterizedTest
    @MethodSource("lookupsDifferingFromTheSavedEventInOnePart")
    void find_lookupDiffersFromTheSavedEventInOnePart_returnsEmpty(String tenantId, String toolType, Instant timestamp,
                                                                    String toolEventId) {
        Optional<LokiLogEvent> found = repository.find(tenantId, toolType, timestamp, toolEventId);

        assertThat(found).isEmpty();
    }

    @ParameterizedTest
    @MethodSource("lookupsWithAValueWrittenToWidenTheQuery")
    void find_lookupValueWrittenToWidenTheQuery_returnsEmpty(String tenantId, String toolType, String toolEventId) {
        Optional<LokiLogEvent> found = repository.find(tenantId, toolType, MOMENT, toolEventId);

        assertThat(found).isEmpty();
    }

    @Test
    void save_eventOlderThanLokiAccepts_throwsRejectedWithLokisReason() {
        LokiLogEvent tooOld = event("tenant-too-old", "evt-1", MOMENT.minus(Duration.ofDays(8)), "{\"ip\":\"10.0.0.1\"}");

        assertThatThrownBy(() -> repository.save(tooOld))
                .isExactlyInstanceOf(LokiPushRejectedException.class)
                .hasMessageStartingWith("Loki push failed with HTTP 400: ")
                .hasMessageContaining("timestamp too old");
    }

    @ParameterizedTest(name = "[{index}] {1}")
    @MethodSource("lineSizesAroundLokisLimitAndOneRead")
    void save_lineOfAnySize_isFoundWhole(int lineBytes, String size) {
        LokiLogEvent event = eventWithLineOf("tenant-" + lineBytes, lineBytes);

        repository.save(event);

        awaitFound(event);
    }

    @Test
    void save_lineOverTheLimitOfTwoByteCharacters_isFoundWhole() {
        LokiLogEvent event = event("tenant-two-byte", "evt-1", MOMENT, "é".repeat(200_000));

        repository.save(event);

        awaitFound(event);
    }

    @Test
    void save_splitEventSentAgainAfterALaterEvent_isStillFoundWhole() {
        LokiLogEvent split = eventWithLineOf("tenant-split-twice", 300_000);
        repository.save(split);
        repository.save(event("tenant-split-twice", "evt-2", MOMENT.plusMillis(1), "{\"ip\":\"10.0.0.2\"}"));

        repository.save(split);

        awaitFound(split);
    }

    @Test
    void find_eventWithAPartMissing_answersNotFound() {
        Map<String, String> labels = Map.of("job", "tool-events", "tenant_id", "tenant-missing-part", "tool_type", "RMM");
        lokiClient.push(labels, MOMENT.toEpochMilli() * 1_000_000, "{\"tenantId\":", partMetadata(0, 3));
        lokiClient.push(labels, MOMENT.toEpochMilli() * 1_000_000 + 1, "\"tenant-missing-part\"", partMetadata(1, 3));
        LokiLogEvent later = event("tenant-missing-part", "evt-2", MOMENT.plusMillis(1), "{\"ip\":\"10.0.0.2\"}");
        repository.save(later);
        awaitFound(later);

        Optional<LokiLogEvent> found = repository.find("tenant-missing-part", "RMM", MOMENT, "evt-1");

        assertThat(found).isEmpty();
    }

    @Test
    void find_eventSavedTwiceInTheSameMillisecondWithDifferentDetails_returnsOneOfThem() {
        LokiLogEvent first = event("tenant-two-versions", "evt-1", MOMENT, "{\"hostname\":\"old-name\"}");
        LokiLogEvent second = event("tenant-two-versions", "evt-1", MOMENT, "{\"hostname\":\"new-name\"}");
        repository.save(first);
        repository.save(second);

        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(repository.find("tenant-two-versions",
                "RMM", MOMENT, "evt-1")).get().isIn(first, second));
    }

    @Test
    void find_splitEventCopiedFromTheOldStoreAndSentAgainLive_returnsIt() {
        LokiLogEvent event = eventWithLineOf("tenant-split-copied", 1_000_000);
        String line = repository.toLine(event);
        Map<String, String> copyLabels = Map.of("job", "tool-events", "tenant_id", "tenant-split-copied", "tool_type", "RMM",
                "origin", "cassandra");
        lokiClient.push(copyLabels, MOMENT.toEpochMilli() * 1_000_000, line.substring(0, 262_144), partMetadata(0, 4));
        lokiClient.push(copyLabels, MOMENT.toEpochMilli() * 1_000_000 + 1, line.substring(262_144, 524_288), partMetadata(1, 4));
        lokiClient.push(copyLabels, MOMENT.toEpochMilli() * 1_000_000 + 2, line.substring(524_288, 786_432), partMetadata(2, 4));
        lokiClient.push(copyLabels, MOMENT.toEpochMilli() * 1_000_000 + 3, line.substring(786_432), partMetadata(3, 4));

        repository.save(event);

        awaitFound(event);
    }

    @Test
    void save_heldEventSentAgainTooFarBehind_isRefusedAndTheEventIsStillFound() {
        LokiLogEvent held = event("tenant-held", "evt-1", MOMENT.minus(Duration.ofHours(2)), "{\"ip\":\"10.0.0.1\"}");
        repository.save(held);
        repository.save(event("tenant-held", "evt-2", MOMENT, "{\"ip\":\"10.0.0.2\"}"));

        assertThatThrownBy(() -> repository.save(held))
                .isExactlyInstanceOf(LokiPushRejectedException.class)
                .hasMessageStartingWith("Loki push failed with HTTP 400: ")
                .hasMessageContaining("entry too far behind");

        awaitFound(held);
    }

    private static Stream<Arguments> lookupsDifferingFromTheSavedEventInOnePart() {
        return Stream.of(
                arguments("tenant-other", "RMM", MOMENT, "evt-1"),
                arguments("tenant-exact", "FLEET", MOMENT, "evt-1"),
                arguments("tenant-exact", "RMM", MOMENT.plusMillis(1), "evt-1"),
                arguments("tenant-exact", "RMM", MOMENT.minusMillis(1), "evt-1"),
                arguments("tenant-exact", "RMM", MOMENT, "evt-2"));
    }

    private static Stream<Arguments> lineSizesAroundLokisLimitAndOneRead() {
        return Stream.of(
                arguments(262_144, "exactly at Loki's line limit: one part"),
                arguments(262_145, "one byte over: two parts"),
                arguments(887_011, "the largest prod event: four parts, one read"),
                arguments(1_048_577, "five parts: two reads"));
    }

    private static Stream<Arguments> lookupsWithAValueWrittenToWidenTheQuery() {
        return Stream.of(
                arguments("tenant-exact", "RMM", "evt-2\" or tool_event_id=~\".+"),
                arguments("tenant-other\"} or {tenant_id=~\".+", "RMM", "evt-1"),
                arguments("tenant-exact", "RMM\"} #", "evt-2"));
    }

    private static void awaitFound(LokiLogEvent event) {
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(repository.find(event.getTenantId(),
                event.getToolType(), Instant.ofEpochMilli(event.getEventTimestamp()), event.getToolEventId()))
                .contains(event));
    }

    private static Map<String, String> partMetadata(int part, int parts) {
        return Map.of("tool_event_id", "evt-1", "part", String.valueOf(part), "parts", String.valueOf(parts));
    }

    private static LokiLogEvent eventWithLineOf(String tenantId, int lineBytes) {
        int bytesBesidesDetails = repository.toLine(event(tenantId, "evt-1", MOMENT, ""))
                .getBytes(StandardCharsets.UTF_8).length;
        return event(tenantId, "evt-1", MOMENT, "x".repeat(lineBytes - bytesBesidesDetails));
    }

    private static LokiLogEvent event(String tenantId, String toolEventId, Instant moment, String details) {
        return LokiLogEvent.builder()
                .tenantId(tenantId)
                .toolType("RMM")
                .eventType("SCRIPT_EXECUTED")
                .toolEventId(toolEventId)
                .ingestDay("2026-10-01")
                .eventTimestamp(moment.toEpochMilli())
                .severity("INFO")
                .message("Script executed")
                .details(details)
                .userId("user-7")
                .deviceId("device-7")
                .hostname("host-7")
                .nickname("Reception iMac")
                .executionSource("MANUAL")
                .scriptCreationSource("AI_ASSISTANT")
                .organizationId("org-7")
                .organizationName("Acme")
                .build();
    }
}
