package com.openframe.stream.mapping;

import com.openframe.data.cassandra.model.CassandraLogEvent;
import com.openframe.data.loki.toolevent.LokiLogEvent;
import com.openframe.kafka.model.IntegratedToolEvent;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;
import org.mapstruct.ReportingPolicy;
import org.springframework.util.StringUtils;

import java.time.Instant;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface LogEventMapper {

    @Mapping(target = "key", source = "event")
    @Mapping(target = "userId", source = "enriched.userId")
    @Mapping(target = "deviceId", source = "enriched.machineId")
    @Mapping(target = "organizationId", source = "enriched.organizationId")
    @Mapping(target = "organizationName", source = "enriched.organizationName")
    @Mapping(target = "severity", source = "event.unifiedEventType.severity")
    @Mapping(target = "message", source = "event", qualifiedByName = "messageOrSummary")
    CassandraLogEvent toCassandraLogEvent(DeserializedDebeziumMessage event, IntegratedToolEnrichedData enriched);

    @Mapping(target = "toolType", source = "integratedToolType")
    @Mapping(target = "eventType", source = "unifiedEventType")
    CassandraLogEvent.CassandraLogEventKey toCassandraLogEventKey(DeserializedDebeziumMessage event);

    @Mapping(target = "tenantId", source = "event.tenantId")
    @Mapping(target = "toolType", source = "event.integratedToolType")
    @Mapping(target = "eventType", source = "event.unifiedEventType")
    @Mapping(target = "userId", source = "enriched.userId")
    @Mapping(target = "deviceId", source = "enriched.machineId")
    @Mapping(target = "organizationId", source = "enriched.organizationId")
    @Mapping(target = "organizationName", source = "enriched.organizationName")
    @Mapping(target = "severity", source = "event.unifiedEventType.severity")
    @Mapping(target = "message", source = "event", qualifiedByName = "messageOrSummary")
    LokiLogEvent toLokiLogEvent(DeserializedDebeziumMessage event, IntegratedToolEnrichedData enriched);

    @Mapping(target = "tenantId", source = "enriched.tenantId")
    @Mapping(target = "toolType", source = "event.integratedToolType")
    @Mapping(target = "eventType", source = "event.unifiedEventType")
    @Mapping(target = "userId", source = "enriched.userId")
    @Mapping(target = "deviceId", source = "enriched.machineId")
    @Mapping(target = "organizationId", source = "enriched.organizationId")
    @Mapping(target = "organizationName", source = "enriched.organizationName")
    @Mapping(target = "severity", source = "event.unifiedEventType.severity")
    @Mapping(target = "summary", source = "event", qualifiedByName = "messageOrSummary")
    IntegratedToolEvent toIntegratedToolEvent(DeserializedDebeziumMessage event, IntegratedToolEnrichedData enriched);

    @Named("messageOrSummary")
    default String messageOrSummary(DeserializedDebeziumMessage event) {
        return StringUtils.hasText(event.getMessage()) ? event.getMessage() : event.getUnifiedEventType().getSummary();
    }

    default Instant toInstant(Long epochMilli) {
        return Instant.ofEpochMilli(epochMilli);
    }
}
