package com.openframe.api.mapper;

import com.openframe.api.dto.audit.LogDetails;
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

    default String toId(LokiLogEvent event) {
        return event.getEventTimestamp() + "_" + event.getToolEventId();
    }

    default Instant toInstant(long epochMilli) {
        return Instant.ofEpochMilli(epochMilli);
    }
}
