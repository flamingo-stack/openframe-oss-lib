package com.openframe.stream.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.kafka.model.IntegratedToolEvent;
import com.openframe.kafka.producer.retry.BaseRetryingKafkaProducer;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import lombok.extern.slf4j.Slf4j;

// TODO when all integrated tools migrate from per-tenant clusters to the shared
//  cluster, the tenant subclass can be removed and this hierarchy collapsed
//  back into a single concrete handler.
@Slf4j
public abstract class DebeziumKafkaMessageHandler
        extends DebeziumMessageHandler<IntegratedToolEvent, DeserializedDebeziumMessage> {

    protected final BaseRetryingKafkaProducer kafkaProducer;
    private final TenantIdProvider tenantIdProvider;
    private final DebeziumEventValidator validator;

    protected DebeziumKafkaMessageHandler(BaseRetryingKafkaProducer kafkaProducer,
                                          ObjectMapper objectMapper,
                                          TenantIdProvider tenantIdProvider,
                                          DebeziumEventValidator validator) {
        super(objectMapper);
        this.kafkaProducer = kafkaProducer;
        this.tenantIdProvider = tenantIdProvider;
        this.validator = validator;
    }

    protected abstract String getTopic();

    @Override
    protected IntegratedToolEvent transform(DeserializedDebeziumMessage debeziumMessage,
                                            IntegratedToolEnrichedData enrichedData) {
        IntegratedToolEvent message = new IntegratedToolEvent();
        try {
            message.setToolEventId(debeziumMessage.getToolEventId());
            message.setUserId(enrichedData.getUserId());
            message.setDeviceId(enrichedData.getMachineId());
            message.setHostname(enrichedData.getHostname());
            message.setOrganizationId(enrichedData.getOrganizationId());
            message.setOrganizationName(enrichedData.getOrganizationName());
            message.setIngestDay(debeziumMessage.getIngestDay());
            message.setToolType(debeziumMessage.getIntegratedToolType().name());
            message.setEventType(debeziumMessage.getUnifiedEventType().name());
            message.setSeverity(debeziumMessage.getUnifiedEventType().getSeverity().name());
            message.setSummary(debeziumMessage.getMessage() == null || debeziumMessage.getMessage().isBlank()
                    ? debeziumMessage.getUnifiedEventType().getSummary()
                    : debeziumMessage.getMessage());
            message.setEventTimestamp(debeziumMessage.getEventTimestamp());
            String resolvedTenantId = enrichedData.getTenantId();
            message.setTenantId(resolvedTenantId != null ? resolvedTenantId : tenantIdProvider.getTenantId());
        } catch (Exception e) {
            log.error("Error processing Kafka message", e);
            throw e;
        }
        return message;
    }

    protected void handleCreate(IntegratedToolEvent message) {
        kafkaProducer.publish(getTopic(), buildMessageBrokerKey(message), message);
    }

    protected void handleRead(IntegratedToolEvent message) {
        handleCreate(message);
    }

    protected void handleUpdate(IntegratedToolEvent message) {
        handleCreate(message);
    }

    protected void handleDelete(IntegratedToolEvent data) {
    }

    @Override
    public EventHandlerType getType() {
        return EventHandlerType.COMMON_TYPE;
    }

    @Override
    public Destination getDestination() {
        return Destination.KAFKA;
    }

    @Override
    protected boolean isValidMessage(DeserializedDebeziumMessage message) {
        return Boolean.TRUE.equals(message.getIsVisible()) && validator.isValid(message);
    }

    private String buildMessageBrokerKey(IntegratedToolEvent message) {
        if (message.getDeviceId() != null) {
            return "%s-%s".formatted(message.getDeviceId(), message.getToolType());
        }
        if (message.getUserId() != null) {
            return "%s-%s".formatted(message.getUserId(), message.getToolType());
        }
        return message.getToolType();
    }
}
