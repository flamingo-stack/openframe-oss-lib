package com.openframe.stream.handler;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.cassandra.model.enums.UnifiedEventType;
import com.openframe.data.loki.client.LokiClient;
import com.openframe.data.loki.client.LokiPushException;
import com.openframe.data.loki.client.LokiPushRejectedException;
import com.openframe.data.loki.client.LokiQueryException;
import com.openframe.data.loki.model.LokiDirection;
import com.openframe.data.loki.model.LokiLogEntry;
import com.openframe.data.loki.toolevent.ToolEventLog;
import com.openframe.data.loki.toolevent.ToolEventLogRepository;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.MockedConstruction;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.stubbing.OngoingStubbing;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.retry.backoff.Sleeper;
import org.springframework.retry.backoff.ThreadWaitSleeper;
import org.springframework.util.unit.DataSize;

import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith({MockitoExtension.class, OutputCaptureExtension.class})
class DebeziumLokiMessageHandlerTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final DataSize ROOMY = DataSize.ofKilobytes(256);
    private static final long EVENT_MILLIS = 1_790_848_800_123L;
    private static final long EVENT_NANOS = 1_790_848_800_123_000_000L;
    private static final Map<String, String> LABELS =
            Map.of("job", "tool-events", "tenant_id", "tenant-a", "tool_type", "RMM");
    private static final Map<String, String> METADATA =
            Map.of("tool_event_id", "evt-1", "event_type", "SCRIPT_FAILED");
    private static final String SMALL_DETAILS = "{\"stdout\":\"ok\"}";
    private static final String LINE_START = """
            {"tenantId":"tenant-a","toolType":"RMM","eventType":"SCRIPT_FAILED","toolEventId":"evt-1",\
            "ingestDay":"2026-10-01","eventTimestamp":1790848800123,"severity":"ERROR",\
            "message":"Script failed on host-7","details":\"""";
    private static final String LINE_END = """
            ","userId":"user-7","deviceId":"device-7","hostname":"host-7","nickname":"Reception iMac",\
            "executionSource":"MANUAL","scriptCreationSource":"AI_ASSISTANT","organizationId":"org-7",\
            "organizationName":"Acme"}""";
    private static final String SMALL_LINE = LINE_START + "{\\\"stdout\\\":\\\"ok\\\"}" + LINE_END;

    @Mock
    private LokiClient lokiClient;

    @Captor
    private ArgumentCaptor<String> lineCaptor;

    private MockedConstruction<ThreadWaitSleeper> sleepers;

    @BeforeEach
    void replaceRealPauses() {
        sleepers = mockConstruction(ThreadWaitSleeper.class);
    }

    @AfterEach
    void restoreRealPauses() {
        sleepers.close();
    }

    @ParameterizedTest
    @ValueSource(strings = {"c", "r", "u"})
    void handle_createReadOrUpdateOperation_savesTheEventUnderItsTenantToolAndOwnTime(String operation) {
        handler(ROOMY).handle(message(operation, SMALL_DETAILS), enriched());

        verify(lokiClient).push(LABELS, EVENT_NANOS, SMALL_LINE, METADATA);
    }

    @Test
    void handle_deleteOperation_savesNothing() {
        handler(ROOMY).handle(message("d", SMALL_DETAILS), enriched());

        verifyNoInteractions(lokiClient);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "  "})
    void handle_eventWithoutItsOwnMessage_savesTheEventTypeSummaryAsMessage(String ownMessage)
            throws JsonProcessingException {
        DeserializedDebeziumMessage message = message("c", SMALL_DETAILS);
        message.setMessage(ownMessage);

        handler(ROOMY).handle(message, enriched());

        assertThat(savedEvent().getMessage()).isEqualTo("Script execution failed");
    }

    @Test
    void handle_lineExactlyAtTheLimit_savesTheDetailsUntouched() {
        String details = "a".repeat(200);
        String line = LINE_START + details + LINE_END;

        handler(DataSize.ofBytes(line.getBytes(UTF_8).length)).handle(message("c", details), enriched());

        verify(lokiClient).push(LABELS, EVENT_NANOS, line, METADATA);
    }

    @Test
    void handle_lineOneByteOverTheLimit_cutsTheDetailsAndMarksThem() throws JsonProcessingException {
        String details = "a".repeat(200);
        int limit = (LINE_START + details + LINE_END).getBytes(UTF_8).length - 1;

        handler(DataSize.ofBytes(limit)).handle(message("c", details), enriched());

        String line = savedLine();
        assertThat(line.getBytes(UTF_8)).hasSize(limit);
        assertThat(detailsOf(line)).isEqualTo("{\"truncated\":true,\"details\":\"" + "a".repeat(162) + "\"}");
    }

    @Test
    void handle_detailsFarOverTheLimit_keepsTheirStartAndEveryOtherField(CapturedOutput output)
            throws JsonProcessingException {
        String details = "start-" + "a".repeat(5_000);

        handler(DataSize.ofBytes(1_000)).handle(message("c", details), enriched());

        String line = savedLine();
        assertThat(line.getBytes(UTF_8)).hasSize(1_000);
        assertThat(JSON.readValue(line, ToolEventLog.class)).isEqualTo(expectedEvent()
                .details("{\"truncated\":true,\"details\":\"start-" + "a".repeat(539) + "\"}")
                .build());
        assertThat(output.getOut()).contains("Tool event details cut to fit the Loki line limit of 1000 bytes: "
                + "tenantId=tenant-a, toolType=RMM, toolEventId=evt-1, detailsChars=5006, keptChars=545");
    }

    @ParameterizedTest(name = "[{index}] limit {1}, {2} byte(s) for one more character")
    @MethodSource("detailsOverTheLimitWithTheBytesOneMoreCharacterNeeds")
    void handle_detailsOverTheLimit_keepsTheirStartUntilNoMoreCharacterFits(
            String details, int limit, int bytesOfOneMoreCharacter, String wholeCharacters)
            throws JsonProcessingException {
        handler(DataSize.ofBytes(limit)).handle(message("c", details), enriched());

        String line = savedLine();
        assertThat(line.getBytes(UTF_8)).hasSizeBetween(limit - bytesOfOneMoreCharacter + 1, limit);
        assertThat(detailsOf(line)).startsWith("{\"truncated\":true,\"details\":\"");
        assertThat(keptDetailsOf(line)).isNotEmpty().matches(wholeCharacters);
    }

    private static Stream<Arguments> detailsOverTheLimitWithTheBytesOneMoreCharacterNeeds() {
        return Stream.of(
                arguments("a".repeat(5_000), 1_000, 1, "a+"),
                arguments("я".repeat(600), 1_000, 2, "я+"),
                arguments("я".repeat(5_000), 1_000, 2, "я+"),
                arguments("😀".repeat(2_500), 1_500, 4, "(😀)+"),
                arguments("😀".repeat(2_500), 1_501, 4, "(😀)+"),
                arguments("😀".repeat(2_500), 1_502, 4, "(😀)+"),
                arguments("😀".repeat(2_500), 1_503, 4, "(😀)+"),
                arguments("\"\\".repeat(2_500), 1_500, 4, "(\"\\\\)*\"?"));
    }

    @Test
    @Timeout(10)
    void handle_lineOverTheLimitEvenWithoutDetails_savesItWithNoDetailsKept() throws JsonProcessingException {
        handler(DataSize.ofBytes(10)).handle(message("c", "a".repeat(200)), enriched());

        assertThat(savedEvent()).isEqualTo(expectedEvent().details("{\"truncated\":true,\"details\":\"\"}").build());
    }

    @Test
    void handle_lokiFailsTwiceThenAnswers_savesOnTheThirdTryAfterOneAndTwoSeconds() throws InterruptedException {
        doThrow(lokiDown()).doThrow(lokiDown()).doNothing()
                .when(lokiClient).push(LABELS, EVENT_NANOS, SMALL_LINE, METADATA);
        DebeziumLokiMessageHandler handler = handler(ROOMY);

        handler.handle(message("c", SMALL_DETAILS), enriched());

        verify(lokiClient, times(3)).push(LABELS, EVENT_NANOS, SMALL_LINE, METADATA);
        InOrder pauses = inOrder(sleeper());
        pauses.verify(sleeper()).sleep(1_000);
        pauses.verify(sleeper()).sleep(2_000);
        pauses.verifyNoMoreInteractions();
    }

    @Test
    void handle_lokiStaysDown_triesSixTimesWithPausesDoublingFromOneToSixteenSecondsThenFails()
            throws InterruptedException {
        LokiPushException down = lokiDown();
        doThrow(down).when(lokiClient).push(LABELS, EVENT_NANOS, SMALL_LINE, METADATA);
        DebeziumLokiMessageHandler handler = handler(ROOMY);

        assertThatThrownBy(() -> handler.handle(message("c", SMALL_DETAILS), enriched())).isSameAs(down);

        verify(lokiClient, times(6)).push(LABELS, EVENT_NANOS, SMALL_LINE, METADATA);
        InOrder pauses = inOrder(sleeper());
        pauses.verify(sleeper()).sleep(1_000);
        pauses.verify(sleeper()).sleep(2_000);
        pauses.verify(sleeper()).sleep(4_000);
        pauses.verify(sleeper()).sleep(8_000);
        pauses.verify(sleeper()).sleep(16_000);
        pauses.verifyNoMoreInteractions();
    }

    @Test
    void handle_lokiRefusesAnEventItDoesNotHold_triesOnceLogsTheDetailsAsLostAndDoesNotFail(CapturedOutput output) {
        doThrow(refusedAsTooOld()).when(lokiClient).push(LABELS, EVENT_NANOS, SMALL_LINE, METADATA);
        whenLookedUp().thenReturn(List.of());
        DebeziumLokiMessageHandler handler = handler(ROOMY);

        assertThatCode(() -> handler.handle(message("c", SMALL_DETAILS), enriched())).doesNotThrowAnyException();

        verify(lokiClient).push(LABELS, EVENT_NANOS, SMALL_LINE, METADATA);
        verifyNoInteractions(sleeper());
        assertThat(output.getOut()).contains("Loki refused the tool event, its details are lost: tenantId=tenant-a, "
                + "toolType=RMM, toolEventId=evt-1, reason=Loki push failed with HTTP 400: timestamp too old");
    }

    @Test
    void handle_lokiRefusesAnEventItAlreadyHolds_doesNotReportTheDetailsAsLost(CapturedOutput output) {
        doThrow(refusedAsTooOld()).when(lokiClient).push(LABELS, EVENT_NANOS, SMALL_LINE, METADATA);
        whenLookedUp().thenReturn(List.of(new LokiLogEntry(EVENT_NANOS, SMALL_LINE, LABELS)));
        DebeziumLokiMessageHandler handler = handler(ROOMY);

        assertThatCode(() -> handler.handle(message("c", SMALL_DETAILS), enriched())).doesNotThrowAnyException();

        verify(lokiClient).push(LABELS, EVENT_NANOS, SMALL_LINE, METADATA);
        assertThat(output.getOut()).doesNotContain("its details are lost").doesNotContain("ERROR");
    }

    @Test
    void handle_lokiRefusesTheEventAndTheLookupFails_letsTheQueryFailureThrough() {
        LokiQueryException failure = new LokiQueryException("Loki query failed with HTTP 503: no healthy querier");
        doThrow(refusedAsTooOld()).when(lokiClient).push(LABELS, EVENT_NANOS, SMALL_LINE, METADATA);
        whenLookedUp().thenThrow(failure);
        DebeziumLokiMessageHandler handler = handler(ROOMY);

        assertThatThrownBy(() -> handler.handle(message("c", SMALL_DETAILS), enriched())).isSameAs(failure);
    }

    @Test
    void handle_lokiFailsThenRefusesTheEvent_stopsRetryingAndDoesNotFail() throws InterruptedException {
        doThrow(lokiDown())
                .doThrow(new LokiPushRejectedException("Loki push failed with HTTP 400: entry too far behind", null))
                .when(lokiClient).push(LABELS, EVENT_NANOS, SMALL_LINE, METADATA);
        DebeziumLokiMessageHandler handler = handler(ROOMY);

        assertThatCode(() -> handler.handle(message("c", SMALL_DETAILS), enriched())).doesNotThrowAnyException();

        verify(lokiClient, times(2)).push(LABELS, EVENT_NANOS, SMALL_LINE, METADATA);
        verify(sleeper()).sleep(1_000);
    }

    @Test
    void handle_failureThatIsNotALokiPushFailure_triesOnceAndLetsItThrough() {
        IllegalStateException failure = new IllegalStateException("not a Loki answer");
        doThrow(failure).when(lokiClient).push(LABELS, EVENT_NANOS, SMALL_LINE, METADATA);
        DebeziumLokiMessageHandler handler = handler(ROOMY);

        assertThatThrownBy(() -> handler.handle(message("c", SMALL_DETAILS), enriched())).isSameAs(failure);

        verify(lokiClient).push(LABELS, EVENT_NANOS, SMALL_LINE, METADATA);
        verifyNoInteractions(sleeper());
    }

    @Test
    void getDestination_always_keepsTheNameOlderServiceJarsKnow() {
        assertThat(handler(ROOMY).getDestination()).hasToString("CASSANDRA_EVENT_LOG");
    }

    @Test
    void getType_always_isTheCommonType() {
        assertThat(handler(ROOMY).getType()).isEqualTo(EventHandlerType.COMMON_TYPE);
    }

    private DebeziumLokiMessageHandler handler(DataSize maxLineSize) {
        return new DebeziumLokiMessageHandler(new ToolEventLogRepository(lokiClient), new ObjectMapper(),
                new TenantIdRequiredDebeziumEventValidator(), maxLineSize);
    }

    private Sleeper sleeper() {
        return sleepers.constructed().getFirst();
    }

    private String savedLine() {
        verify(lokiClient).push(eq(LABELS), eq(EVENT_NANOS), lineCaptor.capture(), eq(METADATA));
        return lineCaptor.getValue();
    }

    private ToolEventLog savedEvent() throws JsonProcessingException {
        return JSON.readValue(savedLine(), ToolEventLog.class);
    }

    private static String detailsOf(String line) throws JsonProcessingException {
        return JSON.readTree(line).get("details").asText();
    }

    private static String keptDetailsOf(String line) throws JsonProcessingException {
        return JSON.readTree(detailsOf(line)).get("details").asText();
    }

    private OngoingStubbing<List<LokiLogEntry>> whenLookedUp() {
        return when(lokiClient.queryRange(
                "{job=\"tool-events\", tenant_id=\"tenant-a\", tool_type=\"RMM\"} | tool_event_id=\"evt-1\" "
                        + "| event_type=\"SCRIPT_FAILED\"",
                EVENT_NANOS, EVENT_NANOS + 1_000_000, 1, LokiDirection.BACKWARD, "tenant-a"));
    }

    private static LokiPushException lokiDown() {
        return new LokiPushException("Loki push failed with HTTP 503: no healthy ingester", null);
    }

    private static LokiPushRejectedException refusedAsTooOld() {
        return new LokiPushRejectedException("Loki push failed with HTTP 400: timestamp too old", null);
    }

    private static ToolEventLog.ToolEventLogBuilder expectedEvent() {
        return ToolEventLog.builder()
                .tenantId("tenant-a")
                .toolType("RMM")
                .eventType("SCRIPT_FAILED")
                .toolEventId("evt-1")
                .ingestDay("2026-10-01")
                .eventTimestamp(EVENT_MILLIS)
                .severity("ERROR")
                .message("Script failed on host-7")
                .userId("user-7")
                .deviceId("device-7")
                .hostname("host-7")
                .nickname("Reception iMac")
                .executionSource("MANUAL")
                .scriptCreationSource("AI_ASSISTANT")
                .organizationId("org-7")
                .organizationName("Acme");
    }

    private static DeserializedDebeziumMessage message(String operation, String details) {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setOperation(operation);
        return DeserializedDebeziumMessage.builder()
                .payload(payload)
                .tenantId("tenant-a")
                .integratedToolType(IntegratedToolType.RMM)
                .unifiedEventType(UnifiedEventType.SCRIPT_FAILED)
                .toolEventId("evt-1")
                .ingestDay("2026-10-01")
                .eventTimestamp(EVENT_MILLIS)
                .message("Script failed on host-7")
                .details(details)
                .userId("user-from-message")
                .organizationId("org-from-message")
                .organizationName("Organization From Message")
                .build();
    }

    private static IntegratedToolEnrichedData enriched() {
        return IntegratedToolEnrichedData.builder()
                .tenantId("tenant-from-enrichment")
                .userId("user-7")
                .machineId("device-7")
                .hostname("host-7")
                .nickname("Reception iMac")
                .executionSource("MANUAL")
                .scriptCreationSource("AI_ASSISTANT")
                .organizationId("org-7")
                .organizationName("Acme")
                .build();
    }
}
