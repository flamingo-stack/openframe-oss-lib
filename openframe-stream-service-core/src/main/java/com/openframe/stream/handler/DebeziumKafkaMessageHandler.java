package com.openframe.stream.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.kafka.producer.retry.OssTenantRetryingKafkaProducer;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.model.enums.Destination;
import com.openframe.kafka.model.IntegratedToolEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

@Slf4j
@Component
public class DebeziumKafkaMessageHandler extends DebeziumMessageHandler<IntegratedToolEvent, DeserializedDebeziumMessage> {

    @Value("${openframe.oss-tenant.kafka.topics.outbound.integrated-tool-events}")
    private String topic;

    /**
     * Retention window in days for incoming events. Messages older than this are skipped —
     * protects against stale Kafka messages (e.g. from a previous customer on a recycled cluster)
     * and matches Pinot's logs table retention.
     */
    @Value("${openframe.stream.event.retention-days:60}")
    private int retentionDays;

    protected final OssTenantRetryingKafkaProducer kafkaProducer;
    private final TenantIdProvider tenantIdProvider;

    public DebeziumKafkaMessageHandler(OssTenantRetryingKafkaProducer kafkaProducer, ObjectMapper objectMapper,
                                       TenantIdProvider tenantIdProvider) {
        super(objectMapper);
        this.kafkaProducer = kafkaProducer;
        this.tenantIdProvider = tenantIdProvider;
    }

    @Override
    protected IntegratedToolEvent transform(DeserializedDebeziumMessage debeziumMessage, IntegratedToolEnrichedData enrichedData) {
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
                    : debeziumMessage.getMessage() );
            message.setEventTimestamp(debeziumMessage.getEventTimestamp());
            message.setTenantId(tenantIdProvider.getTenantId());

        } catch (Exception e) {
            log.error("Error processing Kafka message", e);
            throw e;
        }
        return message;
    }

    protected void handleCreate(IntegratedToolEvent message) {
        kafkaProducer.publish(topic, buildMessageBrokerKey(message), message);
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
        return message.getIsVisible();
    }

    protected String getTopic() {
        return topic;
    }

    private String buildMessageBrokerKey(IntegratedToolEvent message) {
        if (message.getDeviceId() != null) {
            return "%s-%s".formatted(message.getDeviceId(), message.getToolType());
        }  else if (message.getUserId() != null) {
            return "%s-%s".formatted(message.getUserId(), message.getToolType());
        } else {
            return message.getToolType();
        }
    }

}
