package com.openframe.api.mapper;

import com.openframe.api.dto.audit.LogDetails;
import com.openframe.data.cassandra.model.CassandraLogEvent;
import com.openframe.data.loki.toolevent.LokiLogEvent;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

import java.time.Instant;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface LogDetailsMapper {

    @Mapping(target = "id", source = "event")
    @Mapping(target = "timestamp", source = "eventTimestamp")
    @Mapping(target = "summary", source = "message")
    LogDetails toLogDetails(LokiLogEvent event);

    @Mapping(target = ".", source = "key")
    @Mapping(target = "id", source = "event")
    @Mapping(target = "timestamp", source = "key.eventTimestamp")
    @Mapping(target = "summary", source = "message")
    LogDetails toLogDetails(CassandraLogEvent event);

    default String toId(LokiLogEvent event) {
        return event.getEventTimestamp() + "_" + event.getToolEventId();
    }

    default String toId(CassandraLogEvent event) {
        CassandraLogEvent.CassandraLogEventKey key = event.getKey();
        return key.getEventTimestamp().toEpochMilli() + "_" + key.getToolEventId();
    }

    default Instant toInstant(long epochMilli) {
        return Instant.ofEpochMilli(epochMilli);
    }
}
