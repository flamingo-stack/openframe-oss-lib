package com.openframe.api.service;

import com.openframe.api.dto.audit.LogDetails;
import com.openframe.data.cassandra.model.UnifiedLogEvent;
import com.openframe.data.cassandra.repository.UnifiedLogEventRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

@Service
@Slf4j
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.tool-events.store", havingValue = "cassandra")
public class CassandraLogDetailsService implements LogDetailsService {

    private final UnifiedLogEventRepository unifiedLogEventRepository;
    private final TenantIdProvider tenantIdProvider;

    @Override
    public Optional<LogDetails> findLogDetails(String ingestDay, String toolType, String eventType, Instant timestamp,
                                               String toolEventId) {
        log.debug("Finding log details for ingestDay: {}, toolType: {}, eventType: {}, timestamp: {}, toolEventId: {}",
                ingestDay, toolType, eventType, timestamp, toolEventId);

        UnifiedLogEvent.UnifiedLogEventKey key = new UnifiedLogEvent.UnifiedLogEventKey();
        key.setIngestDay(ingestDay);
        key.setToolType(toolType);
        key.setTenantId(tenantIdProvider.getTenantId());
        key.setEventType(eventType);
        key.setEventTimestamp(timestamp);
        key.setToolEventId(toolEventId);

        Optional<UnifiedLogEvent> logEvent = unifiedLogEventRepository.findById(key);

        if (logEvent.isPresent()) {
            LogDetails details = mapToLogDetails(logEvent.get());
            log.debug("Successfully retrieved audit details");
            return Optional.of(details);
        } else {
            log.debug("Log details not found");
            return Optional.empty();
        }
    }

    private LogDetails mapToLogDetails(UnifiedLogEvent logEvent) {
        return LogDetails.builder()
                .id(logEvent.getKey().getEventTimestamp().toEpochMilli() + "_" + logEvent.getKey().getToolEventId())
                .toolEventId(logEvent.getKey().getToolEventId())
                .timestamp(logEvent.getKey().getEventTimestamp())
                .toolType(logEvent.getKey().getToolType())
                .eventType(logEvent.getKey().getEventType())
                .ingestDay(logEvent.getKey().getIngestDay())
                .severity(logEvent.getSeverity())
                .message(logEvent.getMessage())
                .details(logEvent.getDetails())
                .userId(logEvent.getUserId())
                .deviceId(logEvent.getDeviceId())
                .hostname(logEvent.getHostname())
                .nickname(logEvent.getNickname())
                .executionSource(logEvent.getExecutionSource())
                .scriptCreationSource(logEvent.getScriptCreationSource())
                .organizationId(logEvent.getOrganizationId())
                .organizationName(logEvent.getOrganizationName())
                .summary(logEvent.getMessage())
                .build();
    }
}
