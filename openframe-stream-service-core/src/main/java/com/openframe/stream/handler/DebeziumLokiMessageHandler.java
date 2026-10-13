package com.openframe.stream.handler;

import tools.jackson.databind.ObjectMapper;
import com.openframe.data.loki.client.LokiPushException;
import com.openframe.data.loki.client.LokiPushRejectedException;
import com.openframe.data.loki.client.LokiQueryException;
import com.openframe.data.loki.toolevent.ToolEventLog;
import com.openframe.data.loki.toolevent.ToolEventLogRepository;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.retry.RetryCallback;
import org.springframework.retry.RetryContext;
import org.springframework.retry.RetryListener;
import org.springframework.retry.policy.SimpleRetryPolicy;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.Map;

@Slf4j
@Component
@ConditionalOnProperty(name = "openframe.tool-events.store", havingValue = "loki")
public class DebeziumLokiMessageHandler extends DebeziumMessageHandler<ToolEventLog, DeserializedDebeziumMessage> {

    private static final int ATTEMPTS = 6;
    private static final long FIRST_RETRY_DELAY_MILLIS = 1_000;
    private static final long MAX_RETRY_DELAY_MILLIS = 30_000;

    private final ToolEventLogRepository repository;
    private final DebeziumEventValidator eventValidator;
    private final RetryTemplate retry = RetryTemplate.builder()
            .customPolicy(new SimpleRetryPolicy(ATTEMPTS, Map.of(
                    LokiPushException.class, true,
                    LokiQueryException.class, true,
                    LokiPushRejectedException.class, false)))
            .exponentialBackoff(FIRST_RETRY_DELAY_MILLIS, 2, MAX_RETRY_DELAY_MILLIS)
            .withListener(new RetryListener() {
                @Override
                public <T, E extends Throwable> void onError(RetryContext context, RetryCallback<T, E> callback,
                                                             Throwable failure) {
                    if (!(failure instanceof LokiPushRejectedException)) {
                        log.warn("Loki call for a tool event failed, try {} of {}: {}",
                                context.getRetryCount(), ATTEMPTS, failure.getMessage());
                    }
                }
            })
            .build();

    public DebeziumLokiMessageHandler(ToolEventLogRepository repository, ObjectMapper objectMapper,
                                      DebeziumEventValidator eventValidator) {
        super(objectMapper);
        this.repository = repository;
        this.eventValidator = eventValidator;
    }

    @Override
    public EventHandlerType getType() {
        return EventHandlerType.COMMON_TYPE;
    }

    @Override
    public Destination getDestination() {
        return Destination.EVENT_LOG;
    }

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
        try {
            retry.execute(context -> {
                repository.save(event);
                return null;
            });
        } catch (LokiPushRejectedException e) {
            if (isSaved(event)) {
                log.debug("Loki refused a tool event it already holds: tenantId={}, toolType={}, toolEventId={}, "
                                + "eventTimestamp={}, reason={}",
                        event.getTenantId(), event.getToolType(), event.getToolEventId(), event.getEventTimestamp(), e.getMessage());
                return;
            }
            log.error("Loki refused the tool event, its details are lost: tenantId={}, toolType={}, toolEventId={}, "
                            + "eventTimestamp={}, reason={}",
                    event.getTenantId(), event.getToolType(), event.getToolEventId(), event.getEventTimestamp(), e.getMessage());
        }
    }

    private boolean isSaved(ToolEventLog event) {
        return retry.execute(context -> repository.find(event.getTenantId(), event.getToolType(),
                Instant.ofEpochMilli(event.getEventTimestamp()), event.getToolEventId()).isPresent());
    }

    protected void handleRead(ToolEventLog event) {
        handleCreate(event);
    }

    protected void handleUpdate(ToolEventLog event) {
        handleCreate(event);
    }

    protected void handleDelete(ToolEventLog event) {
    }
}
