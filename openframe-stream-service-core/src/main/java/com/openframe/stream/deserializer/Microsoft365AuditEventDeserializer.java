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
 * Deserializes Microsoft 365 Entra directory audit events polled from Graph
 * {@code auditLogs/directoryAudits}. Events are hand-built by the poller (not CDC), arrive
 * pre-enriched with tenant/organization fields in the payload and carry no agent reference —
 * hence {@link com.openframe.data.model.enums.DataEnrichmentServiceType#PRE_ENRICHED}.
 * {@code toolEventId} is the Graph audit record id, so replays from the poller's cursor
 * overlap window upsert idempotently.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class Microsoft365AuditEventDeserializer implements KafkaMessageDeserializer {

    private static final DateTimeFormatter DAY_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneId.of("UTC"));
    private static final String RESULT_FAILURE = "failure";
    private static final String UNKNOWN = "unknown";

    private final ObjectMapper mapper;

    @Override
    public MessageType getType() {
        return MessageType.MICROSOFT_365_AUDIT_EVENT;
    }

    @Override
    public DeserializedDebeziumMessage deserialize(CommonDebeziumMessage debeziumMessage, MessageType messageType) {
        JsonNode after = debeziumMessage.getPayload().getAfter();
        if (after == null || after.isNull()) {
            return null;
        }
        long eventTimestamp = getEventTimestamp(after)
                .orElse(debeziumMessage.getPayload().getTimestamp());
        String category = textField(after, "category").orElse(UNKNOWN);

        return DeserializedDebeziumMessage.builder()
                .payload(debeziumMessage.getPayload())
                .agentId(null)
                .ingestDay(DAY_FORMATTER.format(Instant.ofEpochMilli(eventTimestamp)))
                .sourceEventType(category)
                .toolEventId(textField(after, "auditId").orElse(null))
                .unifiedEventType(resolveEventType(after, category))
                .message(textField(after, "activityDisplayName").orElse(null))
                .integratedToolType(messageType.getIntegratedToolType())
                .debeziumMessage(after.toString())
                .details(buildDetails(after))
                .eventTimestamp(eventTimestamp)
                .skipProcessing(false)
                .isVisible(true)
                .tenantId(textField(after, "tenantId").orElse(null))
                .organizationId(textField(after, "organizationId").orElse(null))
                .organizationName(textField(after, "organizationName").orElse(null))
                .userId(textPath(after.path("initiatedBy").path("user"), "userPrincipalName"))
                .build();
    }

    private UnifiedEventType resolveEventType(JsonNode after, String category) {
        if (textField(after, "result").filter(RESULT_FAILURE::equalsIgnoreCase).isPresent()) {
            return UnifiedEventType.M365_AUDIT_FAILURE;
        }
        UnifiedEventType mapped = EventTypeMapper.mapToUnifiedType(getType().getIntegratedToolType(), category);
        return mapped == UnifiedEventType.UNKNOWN ? UnifiedEventType.M365_AUDIT_OTHER : mapped;
    }

    private Optional<Long> getEventTimestamp(JsonNode after) {
        return textField(after, "activityDateTime")
                .flatMap(value -> {
                    try {
                        return Optional.of(Instant.parse(value).toEpochMilli());
                    } catch (Exception e) {
                        log.warn("Unparseable activityDateTime '{}', falling back to processing timestamp", value);
                        return Optional.empty();
                    }
                });
    }

    private String buildDetails(JsonNode after) {
        ObjectNode details = mapper.createObjectNode();
        JsonNode initiatedBy = after.get("initiatedBy");
        if (initiatedBy != null && !initiatedBy.isNull()) {
            details.set("initiatedBy", initiatedBy);
        }
        JsonNode targetResources = after.get("targetResources");
        if (targetResources != null && !targetResources.isNull()) {
            details.set("targetResources", targetResources);
        }
        return details.toString();
    }

    private Optional<String> textField(JsonNode node, String fieldName) {
        return Optional.ofNullable(node.get(fieldName))
                .filter(field -> !field.isNull())
                .map(JsonNode::asText)
                .filter(StringUtils::isNotBlank);
    }

    private String textPath(JsonNode node, String fieldName) {
        String value = node.path(fieldName).asText(null);
        return StringUtils.isNotBlank(value) ? value : null;
    }
}
