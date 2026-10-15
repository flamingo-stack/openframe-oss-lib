package com.openframe.api.service;

import com.openframe.api.dto.audit.LogDetails;
import com.openframe.data.loki.toolevent.ToolEventLog;
import com.openframe.data.loki.toolevent.ToolEventLogRepository;
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
@ConditionalOnProperty(name = "openframe.tool-events.store", havingValue = "loki")
public class LokiLogDetailsService implements LogDetailsService {

    private final ToolEventLogRepository toolEventLogRepository;
    private final TenantIdProvider tenantIdProvider;

    @Override
    public Optional<LogDetails> findLogDetails(String ingestDay, String toolType, String eventType, Instant timestamp,
                                               String toolEventId) {
        log.debug("Finding log details for toolType: {}, timestamp: {}, toolEventId: {}",
                toolType, timestamp, toolEventId);

        Optional<LogDetails> details = toolEventLogRepository
                .find(tenantIdProvider.getTenantId(), toolType, timestamp, toolEventId)
                .map(this::mapToLogDetails);
        log.debug("Log details found: {}", details.isPresent());
        return details;
    }

    private LogDetails mapToLogDetails(ToolEventLog logEvent) {
        return LogDetails.builder()
                .id(logEvent.getEventTimestamp() + "_" + logEvent.getToolEventId())
                .toolEventId(logEvent.getToolEventId())
                .timestamp(Instant.ofEpochMilli(logEvent.getEventTimestamp()))
                .toolType(logEvent.getToolType())
                .eventType(logEvent.getEventType())
                .ingestDay(logEvent.getIngestDay())
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
