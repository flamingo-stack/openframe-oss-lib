package com.openframe.stream.handler;

import tools.jackson.databind.ObjectMapper;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.kafka.model.IntegratedToolEvent;
import com.openframe.kafka.producer.retry.BaseRetryingKafkaProducer;
import com.openframe.stream.mapping.LogEventMapper;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;

public abstract class DebeziumKafkaMessageHandler
        extends DebeziumMessageHandler<IntegratedToolEvent, DeserializedDebeziumMessage> {

    protected final BaseRetryingKafkaProducer kafkaProducer;
    private final DebeziumEventValidator validator;
    private final LogEventMapper logEventMapper;

    protected DebeziumKafkaMessageHandler(BaseRetryingKafkaProducer kafkaProducer,
                                          ObjectMapper objectMapper,
                                          DebeziumEventValidator validator,
                                          LogEventMapper logEventMapper) {
        super(objectMapper);
        this.kafkaProducer = kafkaProducer;
        this.validator = validator;
        this.logEventMapper = logEventMapper;
    }

    protected abstract String getTopic();

    @Override
    protected IntegratedToolEvent transform(DeserializedDebeziumMessage debeziumMessage,
                                            IntegratedToolEnrichedData enrichedData) {
        return logEventMapper.toIntegratedToolEvent(debeziumMessage, enrichedData);
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
        return Destination.KAFKA_PINOT;
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
