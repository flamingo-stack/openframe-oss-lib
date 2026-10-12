package com.openframe.stream.deserializer;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.cassandra.model.enums.UnifiedEventType;
import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.data.model.enums.MessageType;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class RemoteSessionAuditEventDeserializerTest {

    private static final long PROCESSING_TIMESTAMP = 1791700000000L;
    private static final String SESSION_ID = "session-1";
    private static final String MESH_NODE_ID = "node//mesh-node-1";
    private static final String TECHNICIAN_ID = "technician-1";
    private static final String TECHNICIAN_NAME = "Jane Doe";
    private static final String TENANT_ID = "tenant-1";
    private static final String OCCURRED_AT = "2026-10-12T10:15:30Z";
    private static final String DELETED_EVENT_JSON = """
            {
              "eventType": "REMOTE_SESSION_DELETED",
              "sessionId": "session-1",
              "meshNodeId": "node//mesh-node-1",
              "machineId": "machine-1",
              "technicianId": "technician-1",
              "technicianName": "Jane Doe",
              "tenantId": "tenant-1",
              "occurredAt": "2026-10-12T10:15:30Z"
            }
            """;
    private static final TypeReference<Map<String, Object>> JSON_OBJECT = new TypeReference<>() {
    };

    private ObjectMapper mapper;
    private RemoteSessionAuditEventDeserializer deserializer;

    @BeforeEach
    void setUp() {
        mapper = new ObjectMapper();
        deserializer = new RemoteSessionAuditEventDeserializer(mapper);
    }

    @Test
    void getType_registeredForTheRemoteSessionAuditEvent() {
        // setup
        MessageType expected = MessageType.REMOTE_SESSION_AUDIT_EVENT;

        // execution
        MessageType type = deserializer.getType();

        // verifications
        assertThat(type).isEqualTo(expected);
    }

    @Test
    void deserialize_deletedEvent_identifiesTheDeviceByMeshNodeAndTheActorByTechnician() throws Exception {
        // setup
        CommonDebeziumMessage message = message(DELETED_EVENT_JSON);

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.REMOTE_SESSION_AUDIT_EVENT);

        // verifications
        assertThat(result.getAgentId()).isEqualTo(MESH_NODE_ID);
        assertThat(result.getUserId()).isEqualTo(TECHNICIAN_ID);
        assertThat(result.getTenantId()).isEqualTo(TENANT_ID);
        assertThat(result.getIntegratedToolType()).isEqualTo(IntegratedToolType.MESHCENTRAL);
    }

    @Test
    void deserialize_deletedEvent_typedFromThePayloadWithASessionScopedToolEventId() throws Exception {
        // setup
        CommonDebeziumMessage message = message(DELETED_EVENT_JSON);

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.REMOTE_SESSION_AUDIT_EVENT);

        // verifications
        assertThat(result.getUnifiedEventType()).isEqualTo(UnifiedEventType.REMOTE_SESSION_DELETED);
        assertThat(result.getToolEventId()).isEqualTo(SESSION_ID + ":REMOTE_SESSION_DELETED");
    }

    @Test
    void deserialize_deletedEvent_messageNamesTheTechnician() throws Exception {
        // setup
        CommonDebeziumMessage message = message(DELETED_EVENT_JSON);

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.REMOTE_SESSION_AUDIT_EVENT);

        // verifications
        assertThat(result.getMessage()).isEqualTo("Remote session deleted by " + TECHNICIAN_NAME);
    }

    @Test
    void deserialize_deletedEvent_detailsCarrySessionAndTechnician() throws Exception {
        // setup
        CommonDebeziumMessage message = message(DELETED_EVENT_JSON);

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.REMOTE_SESSION_AUDIT_EVENT);

        // verifications
        Map<String, Object> details = mapper.readValue(result.getDetails(), JSON_OBJECT);
        assertThat(details)
                .containsEntry("sessionId", SESSION_ID)
                .containsEntry("technicianId", TECHNICIAN_ID)
                .containsEntry("technicianName", TECHNICIAN_NAME);
    }

    @Test
    void deserialize_deletedEvent_timedByOccurredAt() throws Exception {
        // setup
        CommonDebeziumMessage message = message(DELETED_EVENT_JSON);
        long occurredAtMillis = Instant.parse(OCCURRED_AT).toEpochMilli();

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.REMOTE_SESSION_AUDIT_EVENT);

        // verifications
        assertThat(result.getEventTimestamp()).isEqualTo(occurredAtMillis);
        assertThat(result.getIngestDay()).isEqualTo("2026-10-12");
    }

    @Test
    void deserialize_sameEventDeliveredTwice_sameToolEventId() throws Exception {
        // setup
        CommonDebeziumMessage first = message(DELETED_EVENT_JSON);
        CommonDebeziumMessage redelivered = message(DELETED_EVENT_JSON);

        // execution
        DeserializedDebeziumMessage firstResult = deserializer.deserialize(first, MessageType.REMOTE_SESSION_AUDIT_EVENT);
        DeserializedDebeziumMessage redeliveredResult = deserializer.deserialize(redelivered, MessageType.REMOTE_SESSION_AUDIT_EVENT);

        // verifications
        assertThat(redeliveredResult.getToolEventId()).isEqualTo(firstResult.getToolEventId());
    }

    private CommonDebeziumMessage message(String afterJson) throws Exception {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setAfter(mapper.readTree(afterJson));
        payload.setOperation("c");
        payload.setTimestamp(PROCESSING_TIMESTAMP);
        CommonDebeziumMessage message = new CommonDebeziumMessage();
        message.setPayload(payload);
        return message;
    }
}
