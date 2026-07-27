package com.openframe.stream.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.cassandra.model.UnifiedLogEvent;
import com.openframe.data.cassandra.model.enums.UnifiedEventType;
import com.openframe.data.cassandra.repository.UnifiedLogEventRepository;
import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * The Cassandra event-log handler must apply the same tenant guard as the Kafka/Pinot handler:
 * an event whose tenant could not be resolved (shared cluster — e.g. a Fleet CDC row without a
 * stamped team_id, or a MeshCentral event with an unknown domain) is DROPPED, never written with
 * a NULL tenant_id into the tenant-keyed unified_logs primary key.
 */
class DebeziumCassandraMessageHandlerTenantGuardTest {

    private UnifiedLogEventRepository repository;
    private DebeziumCassandraMessageHandler handler;

    @BeforeEach
    void setUp() {
        repository = mock(UnifiedLogEventRepository.class);
        handler = new DebeziumCassandraMessageHandler(
                repository, new ObjectMapper(), new TenantIdRequiredDebeziumEventValidator());
    }

    private static DeserializedDebeziumMessage message(String tenantId) {
        DebeziumMessage.Payload<com.fasterxml.jackson.databind.JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setOperation("c");
        DeserializedDebeziumMessage message = DeserializedDebeziumMessage.builder()
                .payload(payload)
                .tenantId(tenantId)
                .toolEventId("evt-1")
                .ingestDay("2026-07-24")
                .integratedToolType(IntegratedToolType.FLEET)
                .unifiedEventType(UnifiedEventType.UNKNOWN)
                .eventTimestamp(1L)
                .build();
        return message;
    }

    @Test
    @DisplayName("no resolved tenant -> event dropped, nothing written to Cassandra")
    void dropsEventWithoutTenant() {
        handler.handle(message(null), new IntegratedToolEnrichedData());
        handler.handle(message(""), new IntegratedToolEnrichedData());
        verifyNoInteractions(repository);
    }

    @Test
    @DisplayName("resolved tenant -> event written")
    void writesEventWithTenant() {
        IntegratedToolEnrichedData enriched = new IntegratedToolEnrichedData();
        enriched.setTenantId("tenant-a");
        handler.handle(message("tenant-a"), enriched);
        verify(repository).save(any(UnifiedLogEvent.class));
    }
}
