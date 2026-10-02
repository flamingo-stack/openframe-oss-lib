package com.openframe.stream.processor;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.cassandra.model.enums.UnifiedEventType;
import com.openframe.data.loki.client.LokiClient;
import com.openframe.data.loki.client.LokiPushException;
import com.openframe.data.loki.client.LokiPushRejectedException;
import com.openframe.data.loki.toolevent.ToolEventLogRepository;
import com.openframe.data.model.enums.DataEnrichmentServiceType;
import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.data.model.enums.MessageType;
import com.openframe.kafka.model.IntegratedToolEvent;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.kafka.producer.retry.OssTenantRetryingKafkaProducer;
import com.openframe.stream.deserializer.KafkaMessageDeserializer;
import com.openframe.stream.handler.DebeziumLokiMessageHandler;
import com.openframe.stream.handler.TenantDebeziumKafkaMessageHandler;
import com.openframe.stream.handler.TenantIdRequiredDebeziumEventValidator;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import com.openframe.stream.service.DataEnrichmentService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedConstruction;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.retry.backoff.ThreadWaitSleeper;
import org.springframework.util.unit.DataSize;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GenericJsonMessageProcessorLokiFailureTest {

    private static final Map<String, String> LABELS =
            Map.of("job", "tool-events", "tenant_id", "tenant-a", "tool_type", "FLEET");
    private static final Map<String, String> METADATA = Map.of("tool_event_id", "evt-1", "event_type", "LOGIN");
    private static final long EVENT_NANOS = 1_790_848_800_123_000_000L;
    private static final String LINE = """
            {"tenantId":"tenant-a","toolType":"FLEET","eventType":"LOGIN","toolEventId":"evt-1",\
            "ingestDay":"2026-10-01","eventTimestamp":1790848800123,"severity":"INFO","message":"User logged in",\
            "deviceId":"device-7"}""";

    @Mock
    private LokiClient lokiClient;

    @Mock
    private OssTenantRetryingKafkaProducer listProducer;

    @Mock
    private KafkaMessageDeserializer deserializer;

    @Mock
    private DataEnrichmentService<DeserializedDebeziumMessage> enrichmentService;

    private MockedConstruction<ThreadWaitSleeper> sleepers;

    @BeforeEach
    void replaceRealPauses() {
        sleepers = mockConstruction(ThreadWaitSleeper.class);
    }

    @AfterEach
    void restoreRealPauses() {
        sleepers.close();
    }

    @Test
    void process_lokiRefusesTheEvent_stillPublishesItToTheList() {
        CommonDebeziumMessage incoming = new CommonDebeziumMessage();
        GenericJsonMessageProcessor processor = processorFor(incoming);
        doThrow(new LokiPushRejectedException("Loki push failed with HTTP 400: timestamp too old", null))
                .when(lokiClient).push(LABELS, EVENT_NANOS, LINE, METADATA);

        processor.process(incoming, MessageType.FLEET_MDM_EVENT);

        verify(listProducer).publish(null, "device-7-FLEET", publishedEvent());
    }

    @Test
    void process_lokiStaysDown_failsTheDeliveryWithoutPublishingToTheList() {
        CommonDebeziumMessage incoming = new CommonDebeziumMessage();
        GenericJsonMessageProcessor processor = processorFor(incoming);
        LokiPushException down = new LokiPushException("Loki push failed with HTTP 503: no healthy ingester", null);
        doThrow(down).when(lokiClient).push(LABELS, EVENT_NANOS, LINE, METADATA);

        assertThatThrownBy(() -> processor.process(incoming, MessageType.FLEET_MDM_EVENT)).isSameAs(down);

        verifyNoInteractions(listProducer);
    }

    private GenericJsonMessageProcessor processorFor(CommonDebeziumMessage incoming) {
        DeserializedDebeziumMessage event = event();
        when(deserializer.getType()).thenReturn(MessageType.FLEET_MDM_EVENT);
        when(deserializer.deserialize(incoming, MessageType.FLEET_MDM_EVENT)).thenReturn(event);
        when(enrichmentService.getType()).thenReturn(DataEnrichmentServiceType.INTEGRATED_TOOLS_EVENTS);
        when(enrichmentService.getExtraParams(event)).thenReturn(
                IntegratedToolEnrichedData.builder().tenantId("tenant-a").machineId("device-7").build());
        TenantIdRequiredDebeziumEventValidator validator = new TenantIdRequiredDebeziumEventValidator();
        return new GenericJsonMessageProcessor(
                List.of(new TenantDebeziumKafkaMessageHandler(listProducer, new ObjectMapper(), validator),
                        new DebeziumLokiMessageHandler(new ToolEventLogRepository(lokiClient), new ObjectMapper(),
                                validator, DataSize.ofKilobytes(256))),
                List.of(enrichmentService),
                List.of(deserializer));
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
                .isVisible(true)
                .build();
    }

    private static IntegratedToolEvent publishedEvent() {
        IntegratedToolEvent event = new IntegratedToolEvent();
        event.setTenantId("tenant-a");
        event.setToolEventId("evt-1");
        event.setDeviceId("device-7");
        event.setIngestDay("2026-10-01");
        event.setToolType("FLEET");
        event.setEventType("LOGIN");
        event.setSeverity("INFO");
        event.setSummary("User logged in");
        event.setEventTimestamp(1_790_848_800_123L);
        return event;
    }
}
