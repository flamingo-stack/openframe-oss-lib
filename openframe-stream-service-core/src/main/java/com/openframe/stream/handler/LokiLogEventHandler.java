package com.openframe.stream.handler;

import tools.jackson.databind.ObjectMapper;
import com.openframe.data.loki.client.LokiPushException;
import com.openframe.data.loki.client.LokiPushRejectedException;
import com.openframe.data.loki.client.LokiQueryException;
import com.openframe.data.loki.toolevent.LokiLogEvent;
import com.openframe.data.loki.toolevent.LokiLogEventRepository;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.stream.mapping.LogEventMapper;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.retry.RetryCallback;
import org.springframework.retry.RetryContext;
import org.springframework.retry.RetryListener;
import org.springframework.retry.policy.SimpleRetryPolicy;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;

@Slf4j
@Component
@ConditionalOnExpression("'${openframe.tool-events.store:}' matches '(?i)loki|both'")
public class LokiLogEventHandler extends DebeziumMessageHandler<LokiLogEvent, DeserializedDebeziumMessage> {

    private static final int ATTEMPTS = 6;
    private static final long FIRST_RETRY_DELAY_MILLIS = 1_000;
    private static final long MAX_RETRY_DELAY_MILLIS = 30_000;

    private final LokiLogEventRepository repository;
    private final DebeziumEventValidator eventValidator;
    private final LogEventMapper logEventMapper;
    private final RetryTemplate retry = RetryTemplate.builder()
            .customPolicy(new SimpleRetryPolicy(ATTEMPTS, Map.of(
                    LokiPushException.class, true,
                    LokiQueryException.class, true,
                    LokiPushRejectedException.class, false)))
            .exponentialBackoff(FIRST_RETRY_DELAY_MILLIS, 2, MAX_RETRY_DELAY_MILLIS)
            .withListener(new RetryListener() {
                @Override
                public <T, E extends Throwable> void onError(RetryContext context, RetryCallback<T, E> callback, Throwable failure) {
                    if (!(failure instanceof LokiPushRejectedException)) {
                        log.warn("Loki call for a tool event failed, try {} of {}: {}",
                                context.getRetryCount(), ATTEMPTS, failure.getMessage());
                    }
                }
            })
            .build();

    public LokiLogEventHandler(LokiLogEventRepository repository, ObjectMapper objectMapper,
                               DebeziumEventValidator eventValidator, LogEventMapper logEventMapper) {
        super(objectMapper);
        this.repository = repository;
        this.eventValidator = eventValidator;
        this.logEventMapper = logEventMapper;
    }

    @Override
    public EventHandlerType getType() {
        return EventHandlerType.COMMON_TYPE;
    }

    @Override
    public Destination getDestination() {
        return Destination.LOKI_EVENT_LOG;
    }

    @Override
    protected boolean isValidMessage(DeserializedDebeziumMessage message) {
        return eventValidator.isValid(message);
    }

    @Override
    protected LokiLogEvent transform(DeserializedDebeziumMessage debeziumMessage, IntegratedToolEnrichedData enrichedData) {
        return logEventMapper.toLokiLogEvent(debeziumMessage, enrichedData);
    }

    protected void handleCreate(LokiLogEvent event) {
        try {
            retry.execute(_ -> {
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

    private boolean isSaved(LokiLogEvent event) {
        return retry.execute(_ -> repository.find(event.getTenantId(), event.getToolType(),
                Instant.ofEpochMilli(event.getEventTimestamp()), event.getToolEventId()).isPresent());
    }

    protected void handleRead(LokiLogEvent event) {
        handleCreate(event);
    }

    protected void handleUpdate(LokiLogEvent event) {
        handleCreate(event);
    }

    protected void handleDelete(LokiLogEvent event) {
    }
}
