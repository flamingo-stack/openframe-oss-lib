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
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GenericJsonMessageProcessorTest {

    @Mock
    private MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> eventLogHandler;

    @Mock
    private MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> pinotHandler;

    @Mock
    private DataEnrichmentService<DeserializedDebeziumMessage> enrichment;

    @Mock
    private KafkaMessageDeserializer deserializer;

    @Test
    void process_noHandlerForTheTenantDestination_eventLogAndPinotStillRun() {
        // setup
        CommonDebeziumMessage message = new CommonDebeziumMessage();
        DeserializedDebeziumMessage deserialized = DeserializedDebeziumMessage.builder().build();
        IntegratedToolEnrichedData enriched = new IntegratedToolEnrichedData();
        when(eventLogHandler.getType()).thenReturn(EventHandlerType.COMMON_TYPE);
        when(eventLogHandler.getDestination()).thenReturn(Destination.CASSANDRA_EVENT_LOG);
        when(pinotHandler.getType()).thenReturn(EventHandlerType.COMMON_TYPE);
        when(pinotHandler.getDestination()).thenReturn(Destination.KAFKA_PINOT);
        when(enrichment.getType()).thenReturn(DataEnrichmentServiceType.INTEGRATED_TOOLS_EVENTS);
        when(enrichment.getExtraParams(deserialized)).thenReturn(enriched);
        when(deserializer.getType()).thenReturn(MessageType.MESHCENTRAL_EVENT);
        when(deserializer.deserialize(message, MessageType.MESHCENTRAL_EVENT)).thenReturn(deserialized);
        GenericJsonMessageProcessor processor = new GenericJsonMessageProcessor(
                List.of(eventLogHandler, pinotHandler), List.of(enrichment), List.of(deserializer));

        // execution
        processor.process(message, MessageType.MESHCENTRAL_EVENT);

        // verifications
        verify(eventLogHandler).handle(deserialized, enriched);
        verify(pinotHandler).handle(deserialized, enriched);
    }
}
