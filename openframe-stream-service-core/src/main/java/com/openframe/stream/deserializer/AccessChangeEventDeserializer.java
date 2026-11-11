package com.openframe.stream.deserializer;

import com.openframe.data.cassandra.model.enums.UnifiedEventType;
import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.data.model.enums.MessageType;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class AccessChangeEventDeserializer implements KafkaMessageDeserializer {

    private static final DateTimeFormatter DAY_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd")
            .withZone(ZoneOffset.UTC);
    private static final String TOOL_EVENT_ID_SEPARATOR = "-";
    private static final String FIELD_ACCESS_CHANGE_ID = "accessChangeId";
    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_ORGANIZATION_ID = "organizationId";
    private static final String FIELD_ORGANIZATION_NAME = "organizationName";
    private static final String FIELD_ACTION = "action";
    private static final String FIELD_TARGET_PERSON_NAME = "targetPersonName";
    private static final String FIELD_SYSTEM = "system";
    private static final String FIELD_EVIDENCE = "evidence";
    private static final String FIELD_OCCURRED_AT = "occurredAt";
    private static final List<String> DETAIL_FIELDS = List.of("actorType", "targetPersonId", FIELD_SYSTEM,
            FIELD_EVIDENCE, "reason", "connectionId", "externalKey", "signInName");

    private static final String PROFILE_CREATED = "PROFILE_CREATED";
    private static final String ACCOUNT_LINKED = "DIRECTORY_ACCOUNT_LINKED";
    private static final String ACCOUNT_UNLINKED = "DIRECTORY_ACCOUNT_UNLINKED";
    private static final String VERIFIED_EMAIL = "VERIFIED_EMAIL";
    private static final Map<String, UnifiedEventType> EVENT_TYPES = Map.of(
            PROFILE_CREATED, UnifiedEventType.IDENTITY_PROFILE_CREATED,
            ACCOUNT_LINKED, UnifiedEventType.IDENTITY_ACCOUNT_LINKED,
            ACCOUNT_UNLINKED, UnifiedEventType.IDENTITY_ACCOUNT_UNLINKED);
    private static final Map<String, String> SYSTEM_NAMES = Map.of(
            "MICROSOFT_365", "Microsoft 365",
            "GOOGLE_WORKSPACE", "Google Workspace");
    private static final String CREATED_MESSAGE = "Created profile for %s from %s";
    private static final String LINKED_VERIFIED_MESSAGE = "Linked %s account to %s (verified address)";
    private static final String LINKED_BY_SYNC_MESSAGE = "Linked %s account to %s (created by the sync)";
    private static final String UNLINKED_MESSAGE = "Unlinked %s account from %s (account gone)";
    private static final String UNKNOWN_ACTION_MESSAGE = "Access change %s for %s";

    private final ObjectMapper mapper;

    @Override
    public MessageType getType() {
        return MessageType.ACCESS_CHANGE_EVENT;
    }

    @Override
    public DeserializedDebeziumMessage deserialize(CommonDebeziumMessage message, MessageType type) {
        DebeziumMessage.Payload<JsonNode> payload = message.getPayload();
        JsonNode after = payload.getAfter();
        String action = text(after, FIELD_ACTION);
        String occurredAtText = text(after, FIELD_OCCURRED_AT);
        Instant occurredAt = Instant.parse(occurredAtText);
        UnifiedEventType eventType = eventTypeOf(action);
        boolean unknownAction = eventType == UnifiedEventType.UNKNOWN;
        if (unknownAction) {
            log.warn("Skipping access change {} with unknown action {}", text(after, FIELD_ACCESS_CHANGE_ID), action);
        }
        String ingestDay = DAY_FORMATTER.format(occurredAt);
        String toolEventId = toolEventId(after);
        String readableMessage = readableMessage(after, eventType, action);
        IntegratedToolType integratedToolType = type.getIntegratedToolType();
        String debeziumMessage = after.toString();
        String details = details(after);
        long eventTimestamp = occurredAt.toEpochMilli();
        String tenantId = text(after, FIELD_TENANT_ID);
        String organizationId = text(after, FIELD_ORGANIZATION_ID);
        String organizationName = text(after, FIELD_ORGANIZATION_NAME);
        return DeserializedDebeziumMessage.builder()
                .payload(payload)
                .ingestDay(ingestDay)
                .sourceEventType(action)
                .toolEventId(toolEventId)
                .unifiedEventType(eventType)
                .message(readableMessage)
                .integratedToolType(integratedToolType)
                .debeziumMessage(debeziumMessage)
                .details(details)
                .eventTimestamp(eventTimestamp)
                .skipProcessing(unknownAction)
                .isVisible(true)
                .tenantId(tenantId)
                .organizationId(organizationId)
                .organizationName(organizationName)
                .build();
    }

    private static UnifiedEventType eventTypeOf(String action) {
        if (action == null) {
            return UnifiedEventType.UNKNOWN;
        }
        return EVENT_TYPES.getOrDefault(action, UnifiedEventType.UNKNOWN);
    }

    private static String toolEventId(JsonNode after) {
        String accessChangeId = text(after, FIELD_ACCESS_CHANGE_ID);
        String organizationId = text(after, FIELD_ORGANIZATION_ID);
        if (organizationId == null) {
            return accessChangeId;
        }
        return accessChangeId + TOOL_EVENT_ID_SEPARATOR + organizationId;
    }

    private static String readableMessage(JsonNode after, UnifiedEventType eventType, String action) {
        String person = text(after, FIELD_TARGET_PERSON_NAME);
        String systemCode = text(after, FIELD_SYSTEM);
        String system = SYSTEM_NAMES.getOrDefault(systemCode, systemCode);
        return switch (eventType) {
            case IDENTITY_PROFILE_CREATED -> CREATED_MESSAGE.formatted(person, system);
            case IDENTITY_ACCOUNT_LINKED -> linkedMessage(after).formatted(system, person);
            case IDENTITY_ACCOUNT_UNLINKED -> UNLINKED_MESSAGE.formatted(system, person);
            default -> UNKNOWN_ACTION_MESSAGE.formatted(action, person);
        };
    }

    private static String linkedMessage(JsonNode after) {
        String evidence = text(after, FIELD_EVIDENCE);
        return VERIFIED_EMAIL.equals(evidence) ? LINKED_VERIFIED_MESSAGE : LINKED_BY_SYNC_MESSAGE;
    }

    private String details(JsonNode after) {
        ObjectNode details = mapper.createObjectNode();
        DETAIL_FIELDS.stream()
                .filter(after::hasNonNull)
                .forEach(field -> copyField(after, details, field));
        return details.toString();
    }

    private static void copyField(JsonNode after, ObjectNode details, String field) {
        JsonNode value = after.get(field);
        details.set(field, value);
    }

    private static String text(JsonNode node, String field) {
        return node.path(field).asString(null);
    }
}
