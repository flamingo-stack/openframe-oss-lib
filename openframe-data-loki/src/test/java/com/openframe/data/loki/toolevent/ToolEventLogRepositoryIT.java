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

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.params.provider.Arguments.arguments;

class ToolEventLogRepositoryIT {

    private static final GenericContainer<?> LOKI = new GenericContainer<>(DockerImageName.parse("grafana/loki:3.7.3"))
            .withExposedPorts(3100)
            .waitingFor(Wait.forHttp("/ready").forPort(3100).forStatusCode(200)
                    .withStartupTimeout(Duration.ofMinutes(2)));

    private static final Instant MOMENT = Instant.now().minus(Duration.ofMinutes(5)).truncatedTo(ChronoUnit.MILLIS);

    private static ToolEventLogRepository repository;

    @BeforeAll
    static void startLoki() {
        LOKI.start();
        repository = new ToolEventLogRepository(new LokiClient(RestClient.builder()
                .baseUrl("http://" + LOKI.getHost() + ":" + LOKI.getMappedPort(3100))
                .build()));
    }

    @Test
    void find_savedEvent_returnsItWithEveryField() {
        ToolEventLog event = event("tenant-round-trip", "evt-1", MOMENT, "{\"ip\":\"10.0.0.1\"}");

        repository.save(event);

        awaitFound(event);
    }

    @Test
    void find_sameEventSavedTwice_returnsItWithTheSameDetails() {
        ToolEventLog event = event("tenant-twice", "evt-1", MOMENT, "{\"ip\":\"10.0.0.1\"}");

        repository.save(event);
        repository.save(event);

        awaitFound(event);
    }

    @Test
    void find_twoEventsInTheSameMillisecond_returnsEachByItsOwnId() {
        ToolEventLog first = event("tenant-same-milli", "evt-1", MOMENT, "{\"output\":\"first\"}");
        ToolEventLog second = event("tenant-same-milli", "evt-2", MOMENT, "{\"output\":\"second\"}");

        repository.save(first);
        repository.save(second);

        awaitFound(first);
        awaitFound(second);
    }

    @Test
    void find_eventSavedAgainLaterWithNewDetails_returnsTheVersionOfTheAskedMoment() {
        ToolEventLog started = event("tenant-versions", "evt-1", MOMENT, "{\"status\":\"started\"}");
        ToolEventLog finished = event("tenant-versions", "evt-1", MOMENT.plusSeconds(1), "{\"status\":\"finished\"}");

        repository.save(started);
        repository.save(finished);

        awaitFound(started);
        awaitFound(finished);
    }

    @Test
    void find_eventIdWithQuotesBracesAndBackslash_returnsThatEvent() {
        ToolEventLog event = event("tenant-odd-id", "evt-\"1\"{x}\\", MOMENT, "{\"ip\":\"10.0.0.1\"}");

        repository.save(event);

        awaitFound(event);
    }

    @ParameterizedTest
    @MethodSource("lookupsDifferingFromTheSavedEventInOnePart")
    void find_lookupDiffersFromTheSavedEventInOnePart_returnsEmpty(String tenantId, String toolType, String eventType,
                                                                    Instant timestamp, String toolEventId) {
        ToolEventLog saved = event("tenant-exact", "evt-1", MOMENT, "{\"ip\":\"10.0.0.1\"}");
        repository.save(saved);
        awaitFound(saved);

        Optional<ToolEventLog> found = repository.find(tenantId, toolType, eventType, timestamp, toolEventId);

        assertThat(found).isEmpty();
    }

    @Test
    void save_eventOlderThanLokiAccepts_throwsRejectedWithLokisReason() {
        ToolEventLog tooOld = event("tenant-too-old", "evt-1", MOMENT.minus(Duration.ofDays(8)), "{\"ip\":\"10.0.0.1\"}");

        assertThatThrownBy(() -> repository.save(tooOld))
                .isExactlyInstanceOf(LokiPushRejectedException.class)
                .hasMessageStartingWith("Loki push failed with HTTP 400: ")
                .hasMessageContaining("timestamp too old");
    }

    @Test
    void save_lineOverLokisDefaultLimit_throwsRejectedWithLokisReason() {
        ToolEventLog tooLong = event("tenant-too-long", "evt-1", MOMENT, "x".repeat(300_000));

        assertThatThrownBy(() -> repository.save(tooLong))
                .isExactlyInstanceOf(LokiPushRejectedException.class)
                .hasMessageStartingWith("Loki push failed with HTTP 400: ")
                .hasMessageContaining("262144");
    }

    @Test
    void find_heldEventRefusedWhenSentAgain_stillReturnsIt() {
        ToolEventLog held = event("tenant-held", "evt-1", MOMENT.minus(Duration.ofHours(2)), "{\"ip\":\"10.0.0.1\"}");
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
                arguments("tenant-other", "RMM", "SCRIPT_EXECUTED", MOMENT, "evt-1"),
                arguments("tenant-exact", "FLEET", "SCRIPT_EXECUTED", MOMENT, "evt-1"),
                arguments("tenant-exact", "RMM", "SCRIPT_FAILED", MOMENT, "evt-1"),
                arguments("tenant-exact", "RMM", "SCRIPT_EXECUTED", MOMENT.plusMillis(1), "evt-1"),
                arguments("tenant-exact", "RMM", "SCRIPT_EXECUTED", MOMENT.minusMillis(1), "evt-1"),
                arguments("tenant-exact", "RMM", "SCRIPT_EXECUTED", MOMENT, "evt-2"),
                arguments("tenant-exact", "RMM", "SCRIPT_EXECUTED", MOMENT, "evt-2\" or tool_event_id=~\".+"),
                arguments("tenant-exact", "RMM", "SCRIPT_FAILED\" or event_type=~\".+", MOMENT, "evt-1"),
                arguments("tenant-other\"} or {tenant_id=~\".+", "RMM", "SCRIPT_EXECUTED", MOMENT, "evt-1"),
                arguments("tenant-other", "RMM\", tenant_id=~\".+", "SCRIPT_EXECUTED", MOMENT, "evt-1"));
    }

    private static void awaitFound(ToolEventLog event) {
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(repository.find(event.getTenantId(),
                event.getToolType(), event.getEventType(), Instant.ofEpochMilli(event.getEventTimestamp()),
                event.getToolEventId())).contains(event));
    }

    private static ToolEventLog event(String tenantId, String toolEventId, Instant moment, String details) {
        return ToolEventLog.builder()
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
