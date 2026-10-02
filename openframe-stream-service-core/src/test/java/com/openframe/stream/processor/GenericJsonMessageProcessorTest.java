package com.openframe.stream.processor;

import com.openframe.data.model.enums.DataEnrichmentServiceType;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.model.enums.MessageType;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.stream.deserializer.KafkaMessageDeserializer;
import com.openframe.stream.handler.MessageHandler;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import com.openframe.stream.service.DataEnrichmentService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GenericJsonMessageProcessorTest {

    private final CommonDebeziumMessage incoming = new CommonDebeziumMessage();
    private final DeserializedDebeziumMessage event =
            DeserializedDebeziumMessage.builder().tenantId("tenant-a").toolEventId("evt-1").build();
    private final IntegratedToolEnrichedData enriched =
            IntegratedToolEnrichedData.builder().tenantId("tenant-a").machineId("device-7").build();

    @Mock
    private MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> eventLogHandler;

    @Mock
    private MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> listHandler;

    @Mock
    private KafkaMessageDeserializer deserializer;

    @Mock
    private DataEnrichmentService<DeserializedDebeziumMessage> enrichmentService;

    @Test
    void process_everyDestinationHandled_savesTheDetailsBeforePublishingToTheList() {
        GenericJsonMessageProcessor processor = processor();

        processor.process(incoming, MessageType.FLEET_MDM_EVENT);

        InOrder calls = inOrder(eventLogHandler, listHandler);
        calls.verify(eventLogHandler).handle(event, enriched);
        calls.verify(listHandler).handle(event, enriched);
    }

    @Test
    void process_savingTheDetailsFails_letsTheFailureThroughWithoutPublishingToTheList() {
        GenericJsonMessageProcessor processor = processor();
        IllegalStateException failure = new IllegalStateException("log store down");
        doThrow(failure).when(eventLogHandler).handle(event, enriched);

        assertThatThrownBy(() -> processor.process(incoming, MessageType.FLEET_MDM_EVENT)).isSameAs(failure);

        verify(listHandler, never()).handle(event, enriched);
    }

    private GenericJsonMessageProcessor processor() {
        when(eventLogHandler.getType()).thenReturn(EventHandlerType.COMMON_TYPE);
        when(eventLogHandler.getDestination()).thenReturn(Destination.CASSANDRA_EVENT_LOG);
        when(listHandler.getType()).thenReturn(EventHandlerType.COMMON_TYPE);
        when(listHandler.getDestination()).thenReturn(Destination.KAFKA_PINOT);
        when(deserializer.getType()).thenReturn(MessageType.FLEET_MDM_EVENT);
        when(deserializer.deserialize(incoming, MessageType.FLEET_MDM_EVENT)).thenReturn(event);
        when(enrichmentService.getType()).thenReturn(DataEnrichmentServiceType.INTEGRATED_TOOLS_EVENTS);
        when(enrichmentService.getExtraParams(event)).thenReturn(enriched);
        return new GenericJsonMessageProcessor(List.of(listHandler, eventLogHandler), List.of(enrichmentService),
                List.of(deserializer));
    }
}
