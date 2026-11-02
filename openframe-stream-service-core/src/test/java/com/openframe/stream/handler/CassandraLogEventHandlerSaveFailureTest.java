package com.openframe.stream.handler;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import com.openframe.data.cassandra.model.CassandraLogEvent;
import com.openframe.data.cassandra.model.enums.UnifiedEventType;
import com.openframe.data.cassandra.repository.CassandraLogEventRepository;
import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.config.ToolEventProperties;
import com.openframe.stream.mapping.LogEventMapper;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(OutputCaptureExtension.class)
class CassandraLogEventHandlerSaveFailureTest {

    private final CassandraLogEventRepository repository = mock(CassandraLogEventRepository.class);
    private final IllegalStateException failure = new IllegalStateException("cassandra down");

    @Test
    void handle_bothStoresAndTheSaveFails_logsItAndLetsTheEventGoOn(CapturedOutput output) {
        when(repository.save(any(CassandraLogEvent.class))).thenThrow(failure);
        CassandraLogEventHandler handler = handler(ToolEventProperties.Store.BOTH);

        assertThatCode(() -> handler.handle(message(), new IntegratedToolEnrichedData())).doesNotThrowAnyException();

        verify(repository).save(any(CassandraLogEvent.class));
        assertThat(output.getOut()).contains("Cassandra failed to save the tool event, it goes on to Loki without it: "
                + "tenantId=tenant-a, toolType=FLEET, toolEventId=evt-1, eventTimestamp=1970-01-01T00:00:00.001Z");
    }

    @Test
    void handle_cassandraOnlyAndTheSaveFails_letsTheFailureThrough() {
        when(repository.save(any(CassandraLogEvent.class))).thenThrow(failure);
        CassandraLogEventHandler handler = handler(ToolEventProperties.Store.CASSANDRA);

        assertThatThrownBy(() -> handler.handle(message(), new IntegratedToolEnrichedData())).isSameAs(failure);
    }

    private CassandraLogEventHandler handler(ToolEventProperties.Store store) {
        return new CassandraLogEventHandler(repository, new JsonMapper(),
                new TenantIdRequiredDebeziumEventValidator(), ToolEventStores.of(store), Mappers.getMapper(LogEventMapper.class));
    }

    private static DeserializedDebeziumMessage message() {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setOperation("c");
        return DeserializedDebeziumMessage.builder()
                .payload(payload)
                .tenantId("tenant-a")
                .toolEventId("evt-1")
                .ingestDay("2026-10-20")
                .integratedToolType(IntegratedToolType.FLEET)
                .unifiedEventType(UnifiedEventType.UNKNOWN)
                .eventTimestamp(1L)
                .build();
    }
}
