package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openframe.data.cassandra.model.enums.UnifiedEventType;
import com.openframe.data.model.enums.MessageType;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

@Component
@RequiredArgsConstructor
public class RemoteSessionAuditEventDeserializer implements KafkaMessageDeserializer {

    private static final DateTimeFormatter DAY_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneOffset.UTC);
    private static final String DELETED_MESSAGE_PREFIX = "Remote session deleted by ";
    private static final String TOOL_EVENT_ID_SEPARATOR = ":";
    private static final String FIELD_EVENT_TYPE = "eventType";
    private static final String FIELD_SESSION_ID = "sessionId";
    private static final String FIELD_MESH_NODE_ID = "meshNodeId";
    private static final String FIELD_TECHNICIAN_ID = "technicianId";
    private static final String FIELD_TECHNICIAN_NAME = "technicianName";
    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_OCCURRED_AT = "occurredAt";

    private final ObjectMapper mapper;

    @Override
    public MessageType getType() {
        return MessageType.REMOTE_SESSION_AUDIT_EVENT;
    }

    @Override
    public DeserializedDebeziumMessage deserialize(CommonDebeziumMessage message, MessageType type) {
        JsonNode after = message.getPayload().getAfter();
        String eventTypeName = text(after, FIELD_EVENT_TYPE);
        String sessionId = text(after, FIELD_SESSION_ID);
        String technicianName = text(after, FIELD_TECHNICIAN_NAME);
        Instant occurredAt = Instant.parse(text(after, FIELD_OCCURRED_AT));
        long eventTimestamp = occurredAt.toEpochMilli();
        return DeserializedDebeziumMessage.builder()
                .payload(message.getPayload())
                .agentId(text(after, FIELD_MESH_NODE_ID))
                .ingestDay(DAY_FORMATTER.format(occurredAt))
                .sourceEventType(eventTypeName)
                .toolEventId(sessionId + TOOL_EVENT_ID_SEPARATOR + eventTypeName)
                .unifiedEventType(UnifiedEventType.valueOf(eventTypeName))
                .message(DELETED_MESSAGE_PREFIX + technicianName)
                .integratedToolType(type.getIntegratedToolType())
                .debeziumMessage(after.toString())
                .details(details(sessionId, after, technicianName))
                .eventTimestamp(eventTimestamp)
                .skipProcessing(false)
                .isVisible(true)
                .tenantId(text(after, FIELD_TENANT_ID))
                .userId(text(after, FIELD_TECHNICIAN_ID))
                .build();
    }

    private String details(String sessionId, JsonNode after, String technicianName) {
        ObjectNode details = mapper.createObjectNode();
        details.put(FIELD_SESSION_ID, sessionId);
        details.put(FIELD_TECHNICIAN_ID, text(after, FIELD_TECHNICIAN_ID));
        details.put(FIELD_TECHNICIAN_NAME, technicianName);
        return details.toString();
    }

    private static String text(JsonNode node, String field) {
        return node.path(field).asText(null);
    }
}
