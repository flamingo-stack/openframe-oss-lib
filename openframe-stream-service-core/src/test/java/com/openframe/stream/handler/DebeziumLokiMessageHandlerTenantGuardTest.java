package com.openframe.stream.handler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.cassandra.model.enums.UnifiedEventType;
import com.openframe.data.loki.client.LokiClient;
import com.openframe.data.loki.toolevent.ToolEventLogRepository;
import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.util.unit.DataSize;

import java.util.Map;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * The Loki event-log handler must apply the same tenant guard as the Kafka/Pinot handler:
 * an event whose tenant could not be resolved (shared cluster — e.g. a Fleet CDC row without a
 * stamped team_id, or a MeshCentral event with an unknown domain) is DROPPED, never written with
 * a NULL tenant_id into a tenant-keyed stream.
 */
@ExtendWith(MockitoExtension.class)
class DebeziumLokiMessageHandlerTenantGuardTest {

    @Mock
    private LokiClient lokiClient;

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    @DisplayName("no resolved tenant -> event dropped, nothing written to Loki")
    void handle_tenantNotResolved_writesNothingToLoki(String tenantId) {
        handler().handle(message(tenantId), new IntegratedToolEnrichedData());

        verifyNoInteractions(lokiClient);
    }

    @Test
    @DisplayName("resolved tenant -> event written under that tenant")
    void handle_tenantResolved_writesTheEventUnderThatTenant() {
        handler().handle(message("tenant-a"), new IntegratedToolEnrichedData());

        verify(lokiClient).push(
                Map.of("job", "tool-events", "tenant_id", "tenant-a", "tool_type", "FLEET"),
                1_000_000L,
                "{\"tenantId\":\"tenant-a\",\"toolType\":\"FLEET\",\"eventType\":\"UNKNOWN\",\"toolEventId\":\"evt-1\","
                        + "\"ingestDay\":\"2026-07-24\",\"eventTimestamp\":1,\"severity\":\"WARNING\","
                        + "\"message\":\"Unknown event\"}",
                Map.of("tool_event_id", "evt-1", "event_type", "UNKNOWN"));
    }

    private DebeziumLokiMessageHandler handler() {
        return new DebeziumLokiMessageHandler(new ToolEventLogRepository(lokiClient), new ObjectMapper(),
                new TenantIdRequiredDebeziumEventValidator(), DataSize.ofKilobytes(256));
    }

    private static DeserializedDebeziumMessage message(String tenantId) {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setOperation("c");
        return DeserializedDebeziumMessage.builder()
                .payload(payload)
                .tenantId(tenantId)
                .toolEventId("evt-1")
                .ingestDay("2026-07-24")
                .integratedToolType(IntegratedToolType.FLEET)
                .unifiedEventType(UnifiedEventType.UNKNOWN)
                .eventTimestamp(1L)
                .build();
    }
}
