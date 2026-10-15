package com.openframe.stream.handler;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import com.openframe.data.cassandra.model.enums.UnifiedEventType;
import com.openframe.data.loki.client.LokiPushException;
import com.openframe.data.loki.client.LokiPushRejectedException;
import com.openframe.data.loki.client.LokiQueryException;
import com.openframe.data.loki.toolevent.ToolEventLog;
import com.openframe.data.loki.toolevent.ToolEventLogRepository;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.MockedConstruction;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.stubbing.OngoingStubbing;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.retry.backoff.Sleeper;
import org.springframework.retry.backoff.ThreadWaitSleeper;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith({MockitoExtension.class, OutputCaptureExtension.class})
class DebeziumLokiMessageHandlerTest {

    private static final long EVENT_MILLIS = 1_790_848_800_123L;
    private static final String DETAILS = "{\"stdout\":\"ok\"}";
    private static final ToolEventLog EVENT = expectedEvent().build();
    private static final Logger HANDLER_LOG = (Logger) LoggerFactory.getLogger(DebeziumLokiMessageHandler.class);

    @Mock
    private ToolEventLogRepository repository;

    @Mock
    private DebeziumEventValidator eventValidator;

    private MockedConstruction<ThreadWaitSleeper> sleepers;

    @BeforeEach
    void replaceRealPausesAndShowDebugLines() {
        sleepers = mockConstruction(ThreadWaitSleeper.class);
        HANDLER_LOG.setLevel(Level.DEBUG);
    }

    @AfterEach
    void restoreRealPausesAndLogLevel() {
        sleepers.close();
        HANDLER_LOG.setLevel(null);
    }

    @ParameterizedTest
    @ValueSource(strings = {"c", "r", "u"})
    void handle_createReadOrUpdateOperation_savesTheEvent(String operation) {
        handler().handle(valid(message(operation)), enriched());

        verify(repository).save(EVENT);
    }

    @Test
    void handle_detailsOverTheLokiLineLimit_savesTheDetailsWhole() {
        String details = "a".repeat(300_000);
        DeserializedDebeziumMessage message = message("c");
        message.setDetails(details);

        handler().handle(valid(message), enriched());

        verify(repository).save(expectedEvent().details(details).build());
    }

    @Test
    void handle_eventWithoutEnrichment_savesTheEventWithoutThoseFields() {
        handler().handle(valid(message("c")), new IntegratedToolEnrichedData());

        verify(repository).save(eventFromMessage().build());
    }

    @Test
    void handle_deleteOperation_savesNothing() {
        handler().handle(valid(message("d")), enriched());

        verifyNoInteractions(repository);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = "t")
    void handle_unknownOrMissingOperation_savesNothing(String operation) {
        handler().handle(valid(message(operation)), enriched());

        verifyNoInteractions(repository);
    }

    @Test
    void handle_eventTheValidatorRejects_savesNothing() {
        DeserializedDebeziumMessage message = message("c");
        when(eventValidator.isValid(message)).thenReturn(false);

        handler().handle(message, enriched());

        verifyNoInteractions(repository);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "  "})
    void handle_eventWithoutItsOwnMessage_savesTheEventTypeSummaryAsMessage(String ownMessage) {
        DeserializedDebeziumMessage message = message("c");
        message.setMessage(ownMessage);

        handler().handle(valid(message), enriched());

        verify(repository).save(expectedEvent().message("Script execution failed").build());
    }

    @Test
    void handle_lokiFailsTwiceThenAnswers_savesOnTheThirdTryAfterOneAndTwoSeconds() throws InterruptedException {
        doThrow(lokiDown()).doThrow(lokiDown()).doNothing().when(repository).save(EVENT);

        handler().handle(valid(message("c")), enriched());

        verify(repository, times(3)).save(EVENT);
        InOrder pauses = inOrder(sleeper());
        pauses.verify(sleeper()).sleep(1_000);
        pauses.verify(sleeper()).sleep(2_000);
        pauses.verifyNoMoreInteractions();
    }

    @Test
    void handle_lokiFailsTwiceThenAnswers_warnsAboutEachFailedTryWithItsReason(CapturedOutput output) {
        doThrow(lokiDown()).doThrow(lokiDown()).doNothing().when(repository).save(EVENT);

        handler().handle(valid(message("c")), enriched());

        assertThat(output.getOut())
                .contains("Loki call for a tool event failed, try 1 of 6: Loki push failed with HTTP 503: no healthy ingester")
                .contains("Loki call for a tool event failed, try 2 of 6: Loki push failed with HTTP 503: no healthy ingester")
                .doesNotContain("try 3 of 6");
    }

    @Test
    void handle_lokiStaysDown_triesSixTimesWithPausesDoublingFromOneToSixteenSecondsThenFails()
            throws InterruptedException {
        LokiPushException down = lokiDown();
        doThrow(down).when(repository).save(EVENT);

        assertThatThrownBy(handlingValidCreate()).isSameAs(down);

        verify(repository, times(6)).save(EVENT);
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
        doThrow(refusedAsTooOld()).when(repository).save(EVENT);
        whenLookedUp().thenReturn(Optional.empty());

        assertThatCode(handlingValidCreate()).doesNotThrowAnyException();

        verify(repository).save(EVENT);
        verifyNoInteractions(sleeper());
        assertThat(output.getOut()).contains("Loki refused the tool event, its details are lost: tenantId=tenant-a, "
                + "toolType=RMM, toolEventId=evt-1, eventTimestamp=1790848800123, reason=Loki push failed with HTTP 400: timestamp too old");
    }

    @Test
    void handle_lokiRefusesAnEventItAlreadyHolds_doesNotReportTheDetailsAsLost(CapturedOutput output) {
        doThrow(refusedAsTooOld()).when(repository).save(EVENT);
        whenLookedUp().thenReturn(Optional.of(EVENT));

        assertThatCode(handlingValidCreate()).doesNotThrowAnyException();

        assertThat(output.getOut())
                .contains("Loki refused a tool event it already holds: tenantId=tenant-a, toolType=RMM, "
                        + "toolEventId=evt-1, eventTimestamp=1790848800123, reason=Loki push failed with HTTP 400: timestamp too old")
                .doesNotContain("Loki refused the tool event, its details are lost")
                .doesNotContain("Loki call for a tool event failed");
    }

    @Test
    void handle_lokiRefusesTheEventAndTheLookupStaysDown_looksUpSixTimesWithDoublingPausesThenFails()
            throws InterruptedException {
        LokiQueryException failure = lookupDown();
        doThrow(refusedAsTooOld()).when(repository).save(EVENT);
        whenLookedUp().thenThrow(failure);

        assertThatThrownBy(handlingValidCreate()).isSameAs(failure);

        verify(repository).save(EVENT);
        verify(repository, times(6)).find("tenant-a", "RMM", Instant.ofEpochMilli(EVENT_MILLIS), "evt-1");
        InOrder pauses = inOrder(sleeper());
        pauses.verify(sleeper()).sleep(1_000);
        pauses.verify(sleeper()).sleep(2_000);
        pauses.verify(sleeper()).sleep(4_000);
        pauses.verify(sleeper()).sleep(8_000);
        pauses.verify(sleeper()).sleep(16_000);
        pauses.verifyNoMoreInteractions();
    }

    @Test
    void handle_lokiRefusesAnEventItHoldsAndTheLookupFailsOnce_looksUpAgainAndDoesNotReportTheDetailsAsLost(
            CapturedOutput output) throws InterruptedException {
        doThrow(refusedAsTooOld()).when(repository).save(EVENT);
        whenLookedUp().thenThrow(lookupDown()).thenReturn(Optional.of(EVENT));

        assertThatCode(handlingValidCreate()).doesNotThrowAnyException();

        verify(sleeper()).sleep(1_000);
        assertThat(output.getOut())
                .contains("Loki call for a tool event failed, try 1 of 6: Loki query failed with HTTP 503: no healthy querier")
                .contains("Loki refused a tool event it already holds: tenantId=tenant-a, toolType=RMM, toolEventId=evt-1")
                .doesNotContain("Loki refused the tool event, its details are lost");
    }

    @Test
    void handle_lokiFailsThenRefusesAnEventItDoesNotHold_stopsRetryingAndLogsTheDetailsAsLost(CapturedOutput output)
            throws InterruptedException {
        doThrow(lokiDown())
                .doThrow(new LokiPushRejectedException("Loki push failed with HTTP 400: entry too far behind", null))
                .when(repository).save(EVENT);
        whenLookedUp().thenReturn(Optional.empty());

        assertThatCode(handlingValidCreate()).doesNotThrowAnyException();

        verify(repository, times(2)).save(EVENT);
        verify(sleeper()).sleep(1_000);
        assertThat(output.getOut()).contains("Loki refused the tool event, its details are lost: tenantId=tenant-a, "
                + "toolType=RMM, toolEventId=evt-1, eventTimestamp=1790848800123, reason=Loki push failed with HTTP 400: entry too far behind");
    }

    @Test
    void handle_failureThatIsNotALokiPushFailure_triesOnceAndLetsItThrough() {
        IllegalStateException failure = new IllegalStateException("not a Loki answer");
        doThrow(failure).when(repository).save(EVENT);

        assertThatThrownBy(handlingValidCreate()).isSameAs(failure);

        verify(repository).save(EVENT);
        verifyNoInteractions(sleeper());
    }

    @Test
    void getDestination_always_isTheLokiEventLog() {
        assertThat(handler().getDestination()).isEqualTo(Destination.LOKI_EVENT_LOG);
    }

    @Test
    void getType_always_isTheCommonType() {
        assertThat(handler().getType()).isEqualTo(EventHandlerType.COMMON_TYPE);
    }

    private DebeziumLokiMessageHandler handler() {
        return new DebeziumLokiMessageHandler(repository, new JsonMapper(), eventValidator);
    }

    private ThrowingCallable handlingValidCreate() {
        DebeziumLokiMessageHandler handler = handler();
        DeserializedDebeziumMessage message = valid(message("c"));
        return () -> handler.handle(message, enriched());
    }

    private Sleeper sleeper() {
        return sleepers.constructed().getFirst();
    }

    private DeserializedDebeziumMessage valid(DeserializedDebeziumMessage message) {
        when(eventValidator.isValid(message)).thenReturn(true);
        return message;
    }

    private OngoingStubbing<Optional<ToolEventLog>> whenLookedUp() {
        return when(repository.find("tenant-a", "RMM", Instant.ofEpochMilli(EVENT_MILLIS), "evt-1"));
    }

    private static LokiPushException lokiDown() {
        return new LokiPushException("Loki push failed with HTTP 503: no healthy ingester", null);
    }

    private static LokiQueryException lookupDown() {
        return new LokiQueryException("Loki query failed with HTTP 503: no healthy querier");
    }

    private static LokiPushRejectedException refusedAsTooOld() {
        return new LokiPushRejectedException("Loki push failed with HTTP 400: timestamp too old", null);
    }

    private static ToolEventLog.ToolEventLogBuilder eventFromMessage() {
        return ToolEventLog.builder()
                .tenantId("tenant-a")
                .toolType("RMM")
                .eventType("SCRIPT_FAILED")
                .toolEventId("evt-1")
                .ingestDay("2026-10-01")
                .eventTimestamp(EVENT_MILLIS)
                .severity("ERROR")
                .message("Script failed on host-7")
                .details(DETAILS);
    }

    private static ToolEventLog.ToolEventLogBuilder expectedEvent() {
        return eventFromMessage()
                .userId("user-7")
                .deviceId("device-7")
                .hostname("host-7")
                .nickname("Reception iMac")
                .executionSource("MANUAL")
                .scriptCreationSource("AI_ASSISTANT")
                .organizationId("org-7")
                .organizationName("Acme");
    }

    private static DeserializedDebeziumMessage message(String operation) {
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
                .details(DETAILS)
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
