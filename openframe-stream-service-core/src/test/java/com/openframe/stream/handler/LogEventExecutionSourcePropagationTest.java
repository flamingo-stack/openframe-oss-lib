package com.openframe.stream.handler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.cassandra.model.enums.UnifiedEventType;
import com.openframe.data.loki.client.LokiClient;
import com.openframe.data.loki.toolevent.ToolEventLog;
import com.openframe.data.loki.toolevent.ToolEventLogRepository;
import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.kafka.model.IntegratedToolEvent;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.kafka.producer.retry.OssTenantRetryingKafkaProducer;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.util.unit.DataSize;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class LogEventExecutionSourcePropagationTest {

    private static final String TENANT_ID = "tenant-a";
    private static final String MACHINE_ID = "6d925893-702a-4223-b62f-2f80b927cbaa";
    private static final String ADMIN_ID = "admin-7";

    @Spy private ToolEventLogRepository repository = new ToolEventLogRepository(mock(LokiClient.class));
    @Mock private OssTenantRetryingKafkaProducer producer;

    @Captor private ArgumentCaptor<ToolEventLog> logEventCaptor;
    @Captor private ArgumentCaptor<IntegratedToolEvent> toolEventCaptor;

    @Test
    @DisplayName("Loki sink: executionSource, scriptCreationSource and the initiator reach the saved log")
    void handle_scriptRunWithOrigin_writesOriginAndInitiatorToLoki() {
        // execution
        lokiHandler().handle(message(), enriched("AI_ASSISTANT", "MANUAL"));

        // verifications
        verify(repository).save(logEventCaptor.capture());
        assertThat(logEventCaptor.getValue())
                .extracting(ToolEventLog::getExecutionSource, ToolEventLog::getScriptCreationSource, ToolEventLog::getUserId)
                .containsExactly("AI_ASSISTANT", "MANUAL", ADMIN_ID);
    }

    @Test
    @DisplayName("Loki sink: a non-script event leaves both origin fields null")
    void handle_eventWithoutOrigin_writesNullOriginToLoki() {
        // execution
        lokiHandler().handle(message(), enriched(null, null));

        // verifications
        verify(repository).save(logEventCaptor.capture());
        assertThat(logEventCaptor.getValue())
                .extracting(ToolEventLog::getExecutionSource, ToolEventLog::getScriptCreationSource)
                .containsExactly(null, null);
    }

    @Test
    @DisplayName("Kafka/Pinot sink: executionSource and scriptCreationSource reach the published message")
    void kafkaHandler_publishesRunOriginFields() {
        // setup
        TenantDebeziumKafkaMessageHandler handler = new TenantDebeziumKafkaMessageHandler(
                producer, new ObjectMapper(), new TenantIdRequiredDebeziumEventValidator());

        // execution
        handler.handle(message(), enriched("SCHEDULED", "AI_ASSISTANT"));

        // verifications
        verify(producer).publish(isNull(), anyString(), toolEventCaptor.capture());
        assertThat(toolEventCaptor.getValue())
                .extracting(IntegratedToolEvent::getExecutionSource, IntegratedToolEvent::getScriptCreationSource)
                .containsExactly("SCHEDULED", "AI_ASSISTANT");
    }

    private DebeziumLokiMessageHandler lokiHandler() {
        return new DebeziumLokiMessageHandler(
                repository, new ObjectMapper(), new TenantIdRequiredDebeziumEventValidator(), DataSize.ofKilobytes(256));
    }

    private static DeserializedDebeziumMessage message() {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setOperation("c");
        return DeserializedDebeziumMessage.builder()
                .payload(payload)
                .tenantId(TENANT_ID)
                .toolEventId("evt-1")
                .ingestDay("2026-09-25")
                .integratedToolType(IntegratedToolType.RMM)
                .unifiedEventType(UnifiedEventType.SCRIPT_EXECUTED)
                .eventTimestamp(1L)
                .isVisible(true)
                .build();
    }

    private static IntegratedToolEnrichedData enriched(String executionSource, String scriptCreationSource) {
        IntegratedToolEnrichedData enriched = new IntegratedToolEnrichedData();
        enriched.setTenantId(TENANT_ID);
        enriched.setMachineId(MACHINE_ID);
        enriched.setUserId(ADMIN_ID);
        enriched.setExecutionSource(executionSource);
        enriched.setScriptCreationSource(scriptCreationSource);
        return enriched;
    }
}
