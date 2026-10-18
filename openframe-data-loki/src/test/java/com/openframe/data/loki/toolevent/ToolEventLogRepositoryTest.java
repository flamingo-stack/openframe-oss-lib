package com.openframe.data.loki.toolevent;

import tools.jackson.core.JacksonException;
import com.openframe.data.loki.client.LokiClient;
import com.openframe.data.loki.client.LokiPushRejectedException;
import com.openframe.data.loki.client.LokiQueryException;
import com.openframe.data.loki.client.LokiQueryRejectedException;
import com.openframe.data.loki.model.LokiDirection;
import com.openframe.data.loki.model.LokiLogEntry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.stubbing.OngoingStubbing;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith({MockitoExtension.class, OutputCaptureExtension.class})
class ToolEventLogRepositoryTest {

    private static final long EVENT_MILLIS = 1_790_848_800_123L;
    private static final long EVENT_NANOS = 1_790_848_800_123_000_000L;
    private static final Instant LAST_NANO_OF_THE_EVENT_MILLI = Instant.parse("2026-10-01T10:00:00.123999999Z");
    private static final int LOKI_LINE_LIMIT_BYTES = 262_144;
    private static final int PARTS_PER_READ = 4;
    private static final Map<String, String> LABELS =
            Map.of("job", "tool-events", "tenant_id", "tenant-a", "tool_type", "FLEET");
    private static final Map<String, String> METADATA = Map.of("tool_event_id", "evt-1");
    private static final String QUERY =
            "{job=\"tool-events\", tenant_id=\"tenant-a\", tool_type=\"FLEET\"} | tool_event_id=\"evt-1\"";
    private static final String FULL_LINE = """
            {"tenantId":"tenant-a","toolType":"FLEET","eventType":"LOGIN","toolEventId":"evt-1",\
            "ingestDay":"2026-10-01","eventTimestamp":1790848800123,"severity":"INFO","message":"User logged in",\
            "details":"{\\"ip\\":\\"10.0.0.1\\"}","userId":"user-7","deviceId":"device-7","hostname":"host-7",\
            "nickname":"Reception iMac","executionSource":"MANUAL","scriptCreationSource":"AI_ASSISTANT",\
            "organizationId":"org-7","organizationName":"Acme"}""";

    @Mock
    private LokiClient lokiClient;

    @InjectMocks
    private ToolEventLogRepository repository;

    @Test
    void save_event_pushesItUnderItsTenantAndToolAtTheEventTime() {
        repository.save(fullEvent());

        verify(lokiClient).push(LABELS, EVENT_NANOS, FULL_LINE, METADATA);
    }

    @Test
    void save_lineExactlyAtLokisLimit_pushesItWholeAsTheOnlyPartWithoutPartNumbers() {
        ToolEventLog event = eventWithLineOf(LOKI_LINE_LIMIT_BYTES);

        repository.save(event);

        verify(lokiClient).push(LABELS, EVENT_NANOS, repository.toLine(event), METADATA);
        verifyNoMoreInteractions(lokiClient);
    }

    @Test
    void save_lineOneByteOverLokisLimit_pushesTwoNumberedPartsAtConsecutiveNanoseconds() {
        ToolEventLog event = eventWithLineOf(LOKI_LINE_LIMIT_BYTES + 1);

        repository.save(event);

        String first = pushedPart(0, 2);
        String second = pushedPart(1, 2);
        assertThat(first.getBytes(UTF_8)).hasSize(LOKI_LINE_LIMIT_BYTES);
        assertThat(second).isEqualTo("}");
        assertThat(first + second).isEqualTo(repository.toLine(event));
    }

    @ParameterizedTest(name = "[{index}] {2}")
    @MethodSource("multiByteCharactersOnTheLimit")
    void save_multiByteCharacterOnTheLimit_endsThePartAtTheLastWholeCharacter(String details, int firstPartBytes,
                                                                             String onTheLimit) {
        ToolEventLog event = fullEvent(details);

        repository.save(event);

        String first = pushedPart(0, 2);
        assertThat(first.getBytes(UTF_8)).hasSize(firstPartBytes);
        assertThat(first + pushedPart(1, 2)).isEqualTo(repository.toLine(event));
    }

    private static Stream<Arguments> multiByteCharactersOnTheLimit() {
        return Stream.of(
                arguments("x" + "é".repeat(140_000), 262_143, "one byte of a two-byte character is over the limit"),
                arguments("x" + "😀".repeat(70_000), 262_141, "three bytes of a four-byte character are over the limit"),
                arguments("😀".repeat(70_000), 262_144, "a four-byte character ends exactly at the limit"));
    }

    @Test
    void save_secondPartRefused_throwsTheRefusalAndPushesNoThirdPart() {
        ToolEventLog event = eventWithLineOf(2 * LOKI_LINE_LIMIT_BYTES + 1);
        String line = repository.toLine(event);
        LokiPushRejectedException refusal = new LokiPushRejectedException(
                "Loki push failed with HTTP 400: entry too far behind", null);
        doNothing().doThrow(refusal).when(lokiClient).push(eq(LABELS), anyLong(), anyString(), anyMap());

        assertThatThrownBy(() -> repository.save(event)).isSameAs(refusal);

        verify(lokiClient).push(LABELS, EVENT_NANOS + 1,
                line.substring(LOKI_LINE_LIMIT_BYTES, 2 * LOKI_LINE_LIMIT_BYTES), partMetadata(1, 3));
        verify(lokiClient, never()).push(LABELS, EVENT_NANOS + 2, line.substring(2 * LOKI_LINE_LIMIT_BYTES),
                partMetadata(2, 3));
    }

    @Test
    void toLine_optionalFieldsNull_leavesThemOut() {
        ToolEventLog event = ToolEventLog.builder()
                .tenantId("tenant-a")
                .toolType("FLEET")
                .eventType("LOGIN")
                .toolEventId("evt-1")
                .eventTimestamp(EVENT_MILLIS)
                .build();

        assertThat(repository.toLine(event)).isEqualTo("{\"tenantId\":\"tenant-a\",\"toolType\":\"FLEET\","
                + "\"eventType\":\"LOGIN\",\"toolEventId\":\"evt-1\",\"eventTimestamp\":1790848800123}");
    }

    @Test
    void find_storedEvent_returnsIt() {
        whenLookedUp().thenReturn(List.of(new LokiLogEntry(EVENT_NANOS, FULL_LINE, Map.of())));

        Optional<ToolEventLog> found = find();

        assertThat(found).contains(fullEvent());
    }

    @Test
    void find_valuesWithQuotesBracesAndBackslashes_keepsEachInsideItsOwnLiteral() {
        repository.find("a\"b", "FLEET\"} or {tenant_id=~\".+", LAST_NANO_OF_THE_EVENT_MILLI,
                "evt\\\" or tool_event_id=~\".+");

        verify(lokiClient).queryRange(
                "{job=\"tool-events\", tenant_id=\"a\\\"b\", tool_type=\"FLEET\\\"} or {tenant_id=~\\\".+\"}"
                        + " | tool_event_id=\"evt\\\\\\\" or tool_event_id=~\\\".+\"",
                EVENT_NANOS - 1, EVENT_NANOS + PARTS_PER_READ, PARTS_PER_READ, LokiDirection.FORWARD, "a\"b");
    }

    @Test
    void find_nothingStored_returnsEmpty() {
        whenLookedUp().thenReturn(List.of());

        Optional<ToolEventLog> found = find();

        assertThat(found).isEmpty();
    }

    @Test
    void find_eventInThreeParts_joinsThemInOrder() {
        whenLookedUp().thenReturn(List.of(
                part(0, 3, FULL_LINE.substring(0, 100)),
                part(1, 3, FULL_LINE.substring(100, 250)),
                part(2, 3, FULL_LINE.substring(250))));

        Optional<ToolEventLog> found = find();

        assertThat(found).contains(fullEvent());
    }

    @Test
    void find_eventInFourParts_joinsThemWithoutASecondRead() {
        whenLookedUp().thenReturn(List.of(
                part(0, 4, FULL_LINE.substring(0, 50)),
                part(1, 4, FULL_LINE.substring(50, 100)),
                part(2, 4, FULL_LINE.substring(100, 200)),
                part(3, 4, FULL_LINE.substring(200))));

        Optional<ToolEventLog> found = find();

        assertThat(found).contains(fullEvent());
        verify(lokiClient).queryRange(QUERY, EVENT_NANOS - 1, EVENT_NANOS + PARTS_PER_READ, PARTS_PER_READ,
                LokiDirection.FORWARD, "tenant-a");
        verifyNoMoreInteractions(lokiClient);
    }

    @Test
    void find_eventInFiveParts_readsOnFromTheLastPartSeen() {
        whenLookedUp().thenReturn(List.of(
                part(0, 5, FULL_LINE.substring(0, 50)),
                part(1, 5, FULL_LINE.substring(50, 100)),
                part(2, 5, FULL_LINE.substring(100, 200)),
                part(3, 5, FULL_LINE.substring(200, 300))));
        whenLookedUpFrom(EVENT_NANOS + 3).thenReturn(List.of(
                part(3, 5, FULL_LINE.substring(200, 300)),
                part(4, 5, FULL_LINE.substring(300))));

        Optional<ToolEventLog> found = find();

        assertThat(found).contains(fullEvent());
    }

    @Test
    void find_firstReadShortOfThePartCount_answersNotFoundAndLogsTheParts(CapturedOutput output) {
        whenLookedUp().thenReturn(List.of(part(0, 3, "{"), part(1, 3, "}")));

        Optional<ToolEventLog> found = find();

        assertThat(found).isEmpty();
        assertThat(output.getOut()).contains("Tool event log in Loki is incomplete, 2 of 3 parts: "
                + "tenantId=tenant-a, toolType=FLEET, toolEventId=evt-1, eventTimestamp=1790848800123");
    }

    @Test
    void find_nextReadEmpty_answersNotFoundAndLogsTheParts(CapturedOutput output) {
        whenLookedUp().thenReturn(List.of(part(0, 5, "{"), part(1, 5, "\"a\""), part(2, 5, ":"), part(3, 5, "1")));
        whenLookedUpFrom(EVENT_NANOS + 3).thenReturn(List.of(part(3, 5, "1")));

        Optional<ToolEventLog> found = find();

        assertThat(found).isEmpty();
        assertThat(output.getOut()).contains("Tool event log in Loki is incomplete, 4 of 5 parts: "
                + "tenantId=tenant-a, toolType=FLEET, toolEventId=evt-1, eventTimestamp=1790848800123");
    }

    @Test
    void find_twoVersionsOfTheEventAtTheSameTime_returnsTheFirst() {
        whenLookedUp().thenReturn(List.of(
                new LokiLogEntry(EVENT_NANOS, FULL_LINE, Map.of()),
                new LokiLogEntry(EVENT_NANOS, FULL_LINE.replace("host-7", "renamed-host"), Map.of())));

        Optional<ToolEventLog> found = find();

        assertThat(found).contains(fullEvent());
    }

    @Test
    void find_twoVersionsOfAPartInTheWindow_takesTheFirst() {
        whenLookedUp().thenReturn(List.of(
                part(0, 2, FULL_LINE.substring(0, 100)),
                part(0, 2, "{\"other\":"),
                part(1, 2, FULL_LINE.substring(100))));

        Optional<ToolEventLog> found = find();

        assertThat(found).contains(fullEvent());
    }

    @Test
    void find_everyPartCopiedInASecondStream_readsOnFromTheLastTimeSeen() {
        whenLookedUp().thenReturn(List.of(
                part(0, 4, FULL_LINE.substring(0, 50)),
                copiedPart(0, 4, FULL_LINE.substring(0, 50)),
                part(1, 4, FULL_LINE.substring(50, 100)),
                copiedPart(1, 4, FULL_LINE.substring(50, 100))));
        whenLookedUpFrom(EVENT_NANOS + 1).thenReturn(List.of(
                part(1, 4, FULL_LINE.substring(50, 100)),
                copiedPart(1, 4, FULL_LINE.substring(50, 100)),
                part(2, 4, FULL_LINE.substring(100, 200)),
                copiedPart(2, 4, FULL_LINE.substring(100, 200))));
        whenLookedUpFrom(EVENT_NANOS + 2).thenReturn(List.of(
                part(2, 4, FULL_LINE.substring(100, 200)),
                copiedPart(2, 4, FULL_LINE.substring(100, 200)),
                part(3, 4, FULL_LINE.substring(200)),
                copiedPart(3, 4, FULL_LINE.substring(200))));

        Optional<ToolEventLog> found = find();

        assertThat(found).contains(fullEvent());
    }

    @Test
    void find_lineWithUnknownFieldsAndNoOptionalOnes_readsWhatItKnows() {
        whenLookedUp().thenReturn(List.of(new LokiLogEntry(EVENT_NANOS,
                "{\"toolEventId\":\"evt-1\",\"eventTimestamp\":1790848800123,\"origin\":\"cassandra\"}", Map.of())));

        Optional<ToolEventLog> found = find();

        assertThat(found).contains(ToolEventLog.builder().toolEventId("evt-1").eventTimestamp(EVENT_MILLIS).build());
    }

    @Test
    void find_lineIsNotJson_throwsQueryFailureWithTheParsingCause() {
        whenLookedUp().thenReturn(List.of(new LokiLogEntry(EVENT_NANOS, "not json", Map.of())));

        assertThatThrownBy(this::find)
                .isExactlyInstanceOf(LokiQueryException.class)
                .hasMessage("Tool event log line in Loki is not readable")
                .hasCauseInstanceOf(JacksonException.class);
    }

    @Test
    void find_lokiRejectsTheLookup_throwsPlainQueryFailureWithLokisReason() {
        LokiQueryRejectedException rejection = new LokiQueryRejectedException(
                "Loki query failed with HTTP 429: too many outstanding requests", null);
        whenLookedUp().thenThrow(rejection);

        assertThatThrownBy(this::find)
                .isExactlyInstanceOf(LokiQueryException.class)
                .hasMessage("Loki query failed with HTTP 429: too many outstanding requests")
                .hasCause(rejection);
    }

    @Test
    void find_lokiFails_letsTheQueryFailureThrough() {
        LokiQueryException failure = new LokiQueryException("Loki query failed: connection refused");
        whenLookedUp().thenThrow(failure);

        assertThatThrownBy(this::find).isSameAs(failure);
    }

    private OngoingStubbing<List<LokiLogEntry>> whenLookedUp() {
        return whenLookedUpFrom(EVENT_NANOS - 1);
    }

    private OngoingStubbing<List<LokiLogEntry>> whenLookedUpFrom(long startNanos) {
        return when(lokiClient.queryRange(QUERY, startNanos, startNanos + 1 + PARTS_PER_READ, PARTS_PER_READ,
                LokiDirection.FORWARD, "tenant-a"));
    }

    private Optional<ToolEventLog> find() {
        return repository.find("tenant-a", "FLEET", LAST_NANO_OF_THE_EVENT_MILLI, "evt-1");
    }

    private String pushedPart(int part, int parts) {
        ArgumentCaptor<String> line = ArgumentCaptor.forClass(String.class);
        verify(lokiClient).push(eq(LABELS), eq(EVENT_NANOS + part), line.capture(), eq(partMetadata(part, parts)));
        return line.getValue();
    }

    private static LokiLogEntry part(int part, int parts, String line) {
        Map<String, String> labels = new HashMap<>(LABELS);
        labels.putAll(partMetadata(part, parts));
        return new LokiLogEntry(EVENT_NANOS + part, line, labels);
    }

    private static LokiLogEntry copiedPart(int part, int parts, String line) {
        Map<String, String> labels = new HashMap<>(part(part, parts, line).labels());
        labels.put("origin", "cassandra");
        return new LokiLogEntry(EVENT_NANOS + part, line, labels);
    }

    private static Map<String, String> partMetadata(int part, int parts) {
        return Map.of("tool_event_id", "evt-1", "part", String.valueOf(part), "parts", String.valueOf(parts));
    }

    private ToolEventLog eventWithLineOf(int lineBytes) {
        int bytesBesidesDetails = repository.toLine(fullEvent("")).getBytes(UTF_8).length;
        return fullEvent("x".repeat(lineBytes - bytesBesidesDetails));
    }

    private static ToolEventLog fullEvent() {
        return fullEvent("{\"ip\":\"10.0.0.1\"}");
    }

    private static ToolEventLog fullEvent(String details) {
        return ToolEventLog.builder()
                .tenantId("tenant-a")
                .toolType("FLEET")
                .eventType("LOGIN")
                .toolEventId("evt-1")
                .ingestDay("2026-10-01")
                .eventTimestamp(EVENT_MILLIS)
                .severity("INFO")
                .message("User logged in")
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
