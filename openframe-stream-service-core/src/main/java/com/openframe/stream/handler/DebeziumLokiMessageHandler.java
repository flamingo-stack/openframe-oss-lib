package com.openframe.stream.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.loki.client.LokiPushException;
import com.openframe.data.loki.client.LokiPushRejectedException;
import com.openframe.data.loki.toolevent.ToolEventLog;
import com.openframe.data.loki.toolevent.ToolEventLogRepository;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.retry.policy.SimpleRetryPolicy;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.util.unit.DataSize;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;

@Slf4j
@Component
@ConditionalOnProperty(name = "openframe.loki.enabled", havingValue = "true")
public class DebeziumLokiMessageHandler extends DebeziumMessageHandler<ToolEventLog, DeserializedDebeziumMessage> {

    private static final int PUSH_ATTEMPTS = 6;
    private static final long FIRST_RETRY_DELAY_MILLIS = 1_000;
    private static final long MAX_RETRY_DELAY_MILLIS = 30_000;

    private final ToolEventLogRepository repository;
    private final DebeziumEventValidator eventValidator;
    private final long maxLineBytes;
    private final RetryTemplate pushRetry = RetryTemplate.builder()
            .customPolicy(new SimpleRetryPolicy(PUSH_ATTEMPTS,
                    Map.of(LokiPushException.class, true, LokiPushRejectedException.class, false)))
            .exponentialBackoff(FIRST_RETRY_DELAY_MILLIS, 2, MAX_RETRY_DELAY_MILLIS)
            .build();

    public DebeziumLokiMessageHandler(ToolEventLogRepository repository, ObjectMapper objectMapper,
                                      DebeziumEventValidator eventValidator,
                                      @Value("${openframe.loki.max-line-size}") DataSize maxLineSize) {
        super(objectMapper);
        this.repository = repository;
        this.eventValidator = eventValidator;
        this.maxLineBytes = maxLineSize.toBytes();
    }

    @Override
    public EventHandlerType getType() {
        return EventHandlerType.COMMON_TYPE;
    }

    @Override
    public Destination getDestination() {
        return Destination.CASSANDRA_EVENT_LOG;
    }

    /**
     * Same tenant guard as the Kafka/Pinot handler: an event whose tenant could not be resolved
     * (shared cluster — e.g. a Fleet CDC row without a stamped {@code team_id}, or a team with no
     * tenant mapping) is dropped instead of being written.
     */
    @Override
    protected boolean isValidMessage(DeserializedDebeziumMessage message) {
        return eventValidator.isValid(message);
    }

    @Override
    protected ToolEventLog transform(DeserializedDebeziumMessage debeziumMessage, IntegratedToolEnrichedData enrichedData) {
        String message = StringUtils.hasText(debeziumMessage.getMessage())
                ? debeziumMessage.getMessage()
                : debeziumMessage.getUnifiedEventType().getSummary();
        return ToolEventLog.builder()
                .tenantId(debeziumMessage.getTenantId())
                .toolType(debeziumMessage.getIntegratedToolType().name())
                .eventType(debeziumMessage.getUnifiedEventType().name())
                .toolEventId(debeziumMessage.getToolEventId())
                .ingestDay(debeziumMessage.getIngestDay())
                .eventTimestamp(debeziumMessage.getEventTimestamp())
                .severity(debeziumMessage.getUnifiedEventType().getSeverity().name())
                .message(message)
                .details(debeziumMessage.getDetails())
                .userId(enrichedData.getUserId())
                .deviceId(enrichedData.getMachineId())
                .hostname(enrichedData.getHostname())
                .nickname(enrichedData.getNickname())
                .executionSource(enrichedData.getExecutionSource())
                .scriptCreationSource(enrichedData.getScriptCreationSource())
                .organizationId(enrichedData.getOrganizationId())
                .organizationName(enrichedData.getOrganizationName())
                .build();
    }

    protected void handleCreate(ToolEventLog event) {
        ToolEventLog fitted = fitToLineLimit(event);
        try {
            pushRetry.execute(context -> {
                repository.save(fitted);
                return null;
            });
        } catch (LokiPushRejectedException e) {
            if (isSaved(event)) {
                log.debug("Loki refused a tool event it already holds: tenantId={}, toolType={}, toolEventId={}, reason={}",
                        event.getTenantId(), event.getToolType(), event.getToolEventId(), e.getMessage());
                return;
            }
            log.error("Loki refused the tool event, its details are lost: tenantId={}, toolType={}, toolEventId={}, reason={}",
                    event.getTenantId(), event.getToolType(), event.getToolEventId(), e.getMessage());
        }
    }

    private boolean isSaved(ToolEventLog event) {
        return repository.find(event.getTenantId(), event.getToolType(), event.getEventType(),
                Instant.ofEpochMilli(event.getEventTimestamp()), event.getToolEventId()).isPresent();
    }

    protected void handleRead(ToolEventLog event) {
        handleCreate(event);
    }

    protected void handleUpdate(ToolEventLog event) {
        handleCreate(event);
    }

    protected void handleDelete(ToolEventLog event) {
    }

    private ToolEventLog fitToLineLimit(ToolEventLog event) {
        long lineBytes = lineBytes(event);
        if (lineBytes <= maxLineBytes) {
            return event;
        }
        String details = event.getDetails();
        int keptChars = details.length();
        ToolEventLog fitted = event;
        while (lineBytes > maxLineBytes && keptChars > 0) {
            keptChars = (int) (keptChars * maxLineBytes / lineBytes);
            if (keptChars > 0 && Character.isHighSurrogate(details.charAt(keptChars - 1))) {
                keptChars--;
            }
            fitted = event.toBuilder().details(truncatedDetails(details.substring(0, keptChars))).build();
            lineBytes = lineBytes(fitted);
        }
        log.warn("Tool event details cut to fit the Loki line limit of {} bytes: tenantId={}, toolType={}, toolEventId={}, "
                        + "detailsChars={}, keptChars={}",
                maxLineBytes, event.getTenantId(), event.getToolType(), event.getToolEventId(), details.length(), keptChars);
        return fitted;
    }

    private long lineBytes(ToolEventLog event) {
        return repository.toLine(event).getBytes(StandardCharsets.UTF_8).length;
    }

    private String truncatedDetails(String keptDetails) {
        return mapper.createObjectNode()
                .put("truncated", true)
                .put("details", keptDetails)
                .toString();
    }
}
