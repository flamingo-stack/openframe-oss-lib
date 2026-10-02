package com.openframe.stream.handler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.cassandra.model.enums.UnifiedEventType;
import com.openframe.data.loki.client.LokiClient;
import com.openframe.data.loki.client.LokiPushException;
import com.openframe.data.loki.toolevent.ToolEventLogRepository;
import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedConstruction;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.retry.backoff.ThreadWaitSleeper;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.util.unit.DataSize;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.Mockito.mockConstruction;
import static org.springframework.test.web.client.ExpectedCount.times;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withNoContent;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

@ExtendWith(OutputCaptureExtension.class)
class DebeziumLokiMessageHandlerLokiAnswerTest {

    private static final String PUSH_URL = "http://loki.test/loki/api/v1/push";

    private MockedConstruction<ThreadWaitSleeper> sleepers;
    private MockRestServiceServer loki;
    private DebeziumLokiMessageHandler handler;

    @BeforeEach
    void replaceRealPausesAndLoki() {
        sleepers = mockConstruction(ThreadWaitSleeper.class);
        RestClient.Builder builder = RestClient.builder().baseUrl("http://loki.test");
        loki = MockRestServiceServer.bindTo(builder).build();
        handler = new DebeziumLokiMessageHandler(new ToolEventLogRepository(new LokiClient(builder.build())),
                new ObjectMapper(), new TenantIdRequiredDebeziumEventValidator(), DataSize.ofKilobytes(256));
    }

    @AfterEach
    void restoreRealPauses() {
        sleepers.close();
    }

    @ParameterizedTest
    @ValueSource(ints = {403, 404, 408})
    void handle_gatewayKeepsAnsweringForbiddenNotFoundOrTimeout_triesSixTimesThenFailsWithoutLoggingARefusal(
            int status, CapturedOutput output) {
        loki.expect(times(6), requestTo(PUSH_URL))
                .andRespond(withStatus(HttpStatusCode.valueOf(status)).body("gateway cannot reach the log store"));

        assertThatThrownBy(() -> handler.handle(event(), new IntegratedToolEnrichedData()))
                .isExactlyInstanceOf(LokiPushException.class)
                .hasMessage("Loki push failed with HTTP " + status + ": gateway cannot reach the log store");

        loki.verify();
        assertThat(output.getOut()).doesNotContain("Loki refused the tool event");
    }

    @ParameterizedTest
    @ValueSource(ints = {403, 404, 408})
    void handle_gatewayAnswersForbiddenNotFoundOrTimeoutThenLokiAccepts_savesOnTheSecondTry(int status) {
        loki.expect(requestTo(PUSH_URL))
                .andRespond(withStatus(HttpStatusCode.valueOf(status)).body("gateway cannot reach the log store"));
        loki.expect(requestTo(PUSH_URL))
                .andRespond(withNoContent());

        assertThatCode(() -> handler.handle(event(), new IntegratedToolEnrichedData())).doesNotThrowAnyException();

        loki.verify();
    }

    @Test
    void handle_lokiAnswersBadRequest_triesOnceLogsTheRefusalAndDoesNotFail(CapturedOutput output) {
        loki.expect(requestTo(PUSH_URL))
                .andRespond(withStatus(HttpStatusCode.valueOf(400)).body("timestamp too old"));
        loki.expect(requestTo(startsWith("http://loki.test/loki/api/v1/query_range")))
                .andRespond(withSuccess("{\"status\":\"success\",\"data\":{\"resultType\":\"streams\",\"result\":[]}}",
                        MediaType.APPLICATION_JSON));

        assertThatCode(() -> handler.handle(event(), new IntegratedToolEnrichedData())).doesNotThrowAnyException();

        loki.verify();
        assertThat(output.getOut()).contains("Loki refused the tool event, its details are lost: tenantId=tenant-a, "
                + "toolType=FLEET, toolEventId=evt-1, reason=Loki push failed with HTTP 400: timestamp too old");
    }

    private static DeserializedDebeziumMessage event() {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setOperation("c");
        return DeserializedDebeziumMessage.builder()
                .payload(payload)
                .tenantId("tenant-a")
                .integratedToolType(IntegratedToolType.FLEET)
                .unifiedEventType(UnifiedEventType.LOGIN)
                .toolEventId("evt-1")
                .ingestDay("2026-10-01")
                .eventTimestamp(1_790_848_800_123L)
                .build();
    }
}
