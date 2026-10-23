package com.openframe.stream.handler;

import tools.jackson.databind.ObjectMapper;
import com.openframe.data.cassandra.model.CassandraLogEvent;
import com.openframe.data.cassandra.repository.CassandraLogEventRepository;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.stream.config.ToolEventProperties;
import com.openframe.stream.mapping.LogEventMapper;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@ConditionalOnClass(CassandraRepository.class)
@ConditionalOnExpression("'${openframe.tool-events.store:}' matches '(?i)cassandra|both'")
public class CassandraLogEventHandler
        extends DebeziumMessageHandler<CassandraLogEvent, DeserializedDebeziumMessage> {

    private final CassandraLogEventRepository repository;
    private final DebeziumEventValidator eventValidator;
    private final ToolEventProperties toolEventProperties;
    private final LogEventMapper logEventMapper;

    public CassandraLogEventHandler(CassandraLogEventRepository repository, ObjectMapper objectMapper,
                                    DebeziumEventValidator eventValidator, ToolEventProperties toolEventProperties,
                                    LogEventMapper logEventMapper) {
        super(objectMapper);
        this.repository = repository;
        this.eventValidator = eventValidator;
        this.toolEventProperties = toolEventProperties;
        this.logEventMapper = logEventMapper;
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
    protected CassandraLogEvent transform(DeserializedDebeziumMessage debeziumMessage, IntegratedToolEnrichedData enrichedData) {
        return logEventMapper.toCassandraLogEvent(debeziumMessage, enrichedData);
    }

    protected void handleCreate(CassandraLogEvent data) {
        try {
            repository.save(data);
        } catch (RuntimeException e) {
            if (toolEventProperties.getStore() != ToolEventProperties.Store.BOTH) {
                throw e;
            }
            CassandraLogEvent.CassandraLogEventKey key = data.getKey();
            log.error("Cassandra failed to save the tool event, it goes on to Loki without it: tenantId={}, toolType={}, "
                            + "toolEventId={}, eventTimestamp={}",
                    key.getTenantId(), key.getToolType(), key.getToolEventId(), key.getEventTimestamp(), e);
        }
    }

    protected void handleRead(CassandraLogEvent message) {
        handleCreate(message);
    }

    protected void handleUpdate(CassandraLogEvent message) {
        handleCreate(message);
    }

    protected void handleDelete(CassandraLogEvent data) {
    }
}
