package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openframe.data.cassandra.model.enums.UnifiedEventType;
import com.openframe.data.model.enums.MessageType;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.stream.mapping.EventTypeMapper;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

/**
 * Deserializes Google Workspace directory audit events polled from the Admin SDK Reports API
 * {@code activities.list("admin")} endpoint. Events are hand-built by the poller (not CDC): a
 * single polled activity's {@code events[]} array is fanned out by the poller into one Kafka
 * record per event, so this deserializer stays 1:1 with {@link KafkaMessageDeserializer#deserialize}
 * (that interface is single-result). The poller writes a FLAT {@code after} object per event with
 * fields {@code uniqueQualifier}, {@code eventIndex}, {@code activityTime}, {@code eventType},
 * {@code eventName}, {@code actorEmail}, {@code ipAddress}, {@code event} (nested JSON carrying the
 * raw event's {@code parameters}), plus tenant/organization passthrough fields ({@code tenantId},
 * {@code organizationId}, {@code organizationName}) and multi-connection fields
 * ({@code connectionId}, {@code connectionName}) — hence
 * {@link com.openframe.data.model.enums.DataEnrichmentServiceType#PRE_ENRICHED}. {@code toolEventId}
 * is {@code uniqueQualifier + "-" + eventIndex}: Reports API activities are uniquely identified by
 * {@code uniqueQualifier}, but a single activity can carry multiple events, so the pair keeps
 * replays from the poller's cursor overlap window upsert idempotent per event. Events carry no
 * agent reference.
 * {@code connectionId}/{@code connectionName} (multi-connection orgs) are passed through into details.
 * <p>
 * {@code event.parameters[]} is an UNTOUCHED passthrough of the Reports API parameter union: each
 * entry always has {@code name}, but its value key varies — {@code value} (string),
 * {@code boolValue}, {@code intValue}, {@code multiValue} (array of strings) or
 * {@code multiMessageValue}. The write-audit publisher (saas-lib
 * {@code GoogleWorkspaceWriteAuditPublisher}) emits only the string {@code {name,value}} member of
 * that union. Consumers rendering details must read
 * {@code value ?? boolValue ?? intValue ?? multiValue} for the scalar/array members; nothing may
 * assume {@code value} alone. {@code multiMessageValue} is deliberately NOT part of that fallback
 * chain — it is an array of nested {@code {parameter: [{name, value, ...}]}} objects, so a consumer
 * that needs it must render it recursively rather than coerce it to a scalar.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GoogleWorkspaceAuditEventDeserializer implements KafkaMessageDeserializer {

    private static final DateTimeFormatter DAY_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneId.of("UTC"));
    // Reports API does not carry a structured success/failure result field; failure is signalled
    // by eventName itself (e.g. LOGIN_FAILURE, login_failure).
    private static final String FAILURE_MARKER = "_FAILURE";
    private static final String UNKNOWN = "unknown";

    private final ObjectMapper mapper;

    @Override
    public MessageType getType() {
        return MessageType.GOOGLE_WORKSPACE_AUDIT_EVENT;
    }

    @Override
    public DeserializedDebeziumMessage deserialize(CommonDebeziumMessage debeziumMessage, MessageType messageType) {
        JsonNode after = debeziumMessage.getPayload().getAfter();
        if (after == null || after.isNull()) {
            return null;
        }
        long eventTimestamp = getEventTimestamp(after)
                .orElse(debeziumMessage.getPayload().getTimestamp());
        String eventType = textField(after, "eventType").orElse(UNKNOWN);

        return DeserializedDebeziumMessage.builder()
                .payload(debeziumMessage.getPayload())
                .agentId(null)
                .ingestDay(DAY_FORMATTER.format(Instant.ofEpochMilli(eventTimestamp)))
                .sourceEventType(eventType)
                .toolEventId(buildToolEventId(after))
                .unifiedEventType(resolveEventType(after, eventType))
                .message(textField(after, "eventName").orElse(null))
                .integratedToolType(messageType.getIntegratedToolType())
                .debeziumMessage(after.toString())
                .details(buildDetails(after))
                .eventTimestamp(eventTimestamp)
                .skipProcessing(false)
                .isVisible(true)
                .tenantId(textField(after, "tenantId").orElse(null))
                .organizationId(textField(after, "organizationId").orElse(null))
                .organizationName(textField(after, "organizationName").orElse(null))
                .userId(textField(after, "actorEmail").orElse(null))
                .build();
    }

    private UnifiedEventType resolveEventType(JsonNode after, String eventType) {
        String eventName = textField(after, "eventName").orElse("");
        if (StringUtils.containsIgnoreCase(eventName, FAILURE_MARKER)) {
            return UnifiedEventType.GWS_AUDIT_FAILURE;
        }
        UnifiedEventType mapped = EventTypeMapper.mapToUnifiedType(getType().getIntegratedToolType(), eventType);
        return mapped == UnifiedEventType.UNKNOWN ? UnifiedEventType.GWS_AUDIT_OTHER : mapped;
    }

    private String buildToolEventId(JsonNode after) {
        return textField(after, "uniqueQualifier")
                .map(uniqueQualifier -> uniqueQualifier + "-" + textField(after, "eventIndex").orElse("0"))
                .orElse(null);
    }

    private Optional<Long> getEventTimestamp(JsonNode after) {
        return textField(after, "activityTime")
                .flatMap(value -> {
                    try {
                        return Optional.of(Instant.parse(value).toEpochMilli());
                    } catch (Exception e) {
                        log.warn("Unparseable activityTime '{}', falling back to processing timestamp", value);
                        return Optional.empty();
                    }
                });
    }

    private String buildDetails(JsonNode after) {
        ObjectNode details = mapper.createObjectNode();
        JsonNode event = after.get("event");
        if (event != null && !event.isNull()) {
            details.set("event", event);
        }
        textField(after, "ipAddress").ifPresent(value -> details.put("ipAddress", value));
        textField(after, "connectionId").ifPresent(value -> details.put("connectionId", value));
        textField(after, "connectionName").ifPresent(value -> details.put("connectionName", value));
        return details.toString();
    }

    private Optional<String> textField(JsonNode node, String fieldName) {
        return Optional.ofNullable(node.get(fieldName))
                .filter(field -> !field.isNull())
                .map(JsonNode::asText)
                .filter(StringUtils::isNotBlank);
    }
}
