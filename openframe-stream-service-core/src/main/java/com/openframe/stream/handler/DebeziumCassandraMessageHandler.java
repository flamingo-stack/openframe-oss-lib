package com.openframe.stream.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.cassandra.model.UnifiedLogEvent;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Slf4j
@Component
// TODO temporary: Cassandra is not yet deployed in the shared SaaS cluster, so
//  the bean is gated on Spring Data Cassandra being on the classpath. Remove
//  once shared Cassandra is provisioned and `openframe-data-cassandra` is no
//  longer excluded from openframe-saas-stream.
@ConditionalOnClass(CassandraRepository.class)
public class DebeziumCassandraMessageHandler extends DebeziumMessageHandler<UnifiedLogEvent, DeserializedDebeziumMessage> {

    private final CassandraRepository repository;

    protected DebeziumCassandraMessageHandler(CassandraRepository repository, ObjectMapper objectMapper) {
        super(objectMapper);
        this.repository = repository;
    }

    @Override
    public EventHandlerType getType() {
        return EventHandlerType.COMMON_TYPE;
    }

    @Override
    public Destination getDestination() {
        return Destination.CASSANDRA;
    }

    @Override
    protected UnifiedLogEvent transform(DeserializedDebeziumMessage debeziumMessage, IntegratedToolEnrichedData enrichedData) {
        UnifiedLogEvent logEvent = new UnifiedLogEvent();
        try {
            UnifiedLogEvent.UnifiedLogEventKey key = createKey(debeziumMessage);
            logEvent.setKey(key);
            logEvent.setUserId(enrichedData.getUserId());
            logEvent.setDeviceId(enrichedData.getMachineId());
            logEvent.setHostname(enrichedData.getHostname());
            logEvent.setOrganizationId(enrichedData.getOrganizationId());
            logEvent.setOrganizationName(enrichedData.getOrganizationName());
            logEvent.setSeverity(debeziumMessage.getUnifiedEventType().getSeverity().name());
            logEvent.setDebeziumMessage(debeziumMessage.getDebeziumMessage());
            logEvent.setMessage(debeziumMessage.getMessage() ==  null
                    ? debeziumMessage.getUnifiedEventType().getSummary()
                    : debeziumMessage.getMessage());
            logEvent.setDetails(debeziumMessage.getDetails());

        } catch (Exception e) {
            log.error("Error processing Kafka message", e);
            throw e;
        }
        return logEvent;
    }

    protected UnifiedLogEvent.UnifiedLogEventKey createKey(DeserializedDebeziumMessage debeziumMessage) {
        UnifiedLogEvent.UnifiedLogEventKey key = new UnifiedLogEvent.UnifiedLogEventKey();
        Instant timestamp = Instant.ofEpochMilli(debeziumMessage.getEventTimestamp());

        key.setIngestDay(debeziumMessage.getIngestDay());
        key.setToolType(debeziumMessage.getIntegratedToolType().name());
        key.setEventType(debeziumMessage.getUnifiedEventType().name());
        key.setEventTimestamp(timestamp);
        key.setToolEventId(debeziumMessage.getToolEventId());

        return key;
    }

    protected void handleCreate(UnifiedLogEvent data) {
        repository.save(data);
    }

    protected void handleRead(UnifiedLogEvent message) {
        handleCreate(message);
    }

    protected void handleUpdate(UnifiedLogEvent message) {
        handleCreate(message);
    }

    protected void handleDelete(UnifiedLogEvent data) {
    }
}
