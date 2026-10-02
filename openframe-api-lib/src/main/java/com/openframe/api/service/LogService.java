package com.openframe.api.service;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.audit.*;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.data.loki.toolevent.ToolEventLog;
import com.openframe.data.loki.toolevent.ToolEventLogRepository;
import com.openframe.data.pinot.model.LogProjection;
import com.openframe.data.pinot.model.OrganizationOption;
import com.openframe.data.pinot.repository.PinotLogRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Slf4j
@AllArgsConstructor
@ConditionalOnProperty(name = "openframe.loki.enabled", havingValue = "true")
public class LogService {

    private final PinotLogRepository pinotLogRepository;
    private final ToolEventLogRepository toolEventLogRepository;
    private final TenantIdProvider tenantIdProvider;


    public GenericQueryResult<LogEvent> queryLogs(LogFilterCriteria filter, CursorPaginationCriteria paginationCriteria, String search, SortInput sort) {
        CursorPaginationCriteria normalizedCriteria = paginationCriteria.normalize();

        log.debug("Querying logs with filter: {}, pagination: {}, search: {}, sort: {}",
                filter, normalizedCriteria, search, sort);

        LocalDate startDate = filter.getStartDate();
        LocalDate endDate = filter.getEndDate();
        Instant timestampFrom = filter.getTimestampFrom();
        Instant timestampTo = filter.getTimestampTo();
        List<String> toolTypes = filter.getToolTypes();
        List<String> eventTypes = filter.getEventTypes();
        List<String> severities = filter.getSeverities();
        List<LogProjection> logs;

        String cursor = normalizedCriteria.getCursor();
        int limit = normalizedCriteria.getLimit();

        List<String> organizationIds = filter.getOrganizationIds();
        String deviceId = filter.getDeviceId();

        String sortField = validateSortField(sort != null ? sort.getField() : null);
        String sortDirection = (sort != null && sort.getDirection() != null) ?
            sort.getDirection().name() : "DESC";

        if (search != null && !search.trim().isEmpty()) {
            log.debug("Using search functionality with term: {}", search);
            logs = pinotLogRepository.searchLogs(
                    tenantIdProvider.getTenantId(),
                    startDate, endDate,
                    timestampFrom, timestampTo,
                    toolTypes, eventTypes, severities,
                    organizationIds, deviceId,
                    search, cursor, limit + 1,
                    sortField, sortDirection);
        } else {
            log.debug("Using exact field filtering");
            logs = pinotLogRepository.findLogs(
                    tenantIdProvider.getTenantId(),
                    startDate, endDate,
                    timestampFrom, timestampTo,
                    toolTypes, eventTypes, severities,
                    organizationIds, deviceId,
                    cursor, limit + 1,
                    sortField, sortDirection);
        }

        log.debug("Retrieved {} logs from Pinot", logs != null ? logs.size() : 0);

        GenericQueryResult<LogEvent> result = buildLogQueryResult(logs, cursor, limit);

        log.debug("Successfully built result with {} events", result.getItems().size());
        return result;
    }

    public Optional<LogDetails> findLogDetails(String toolType, String eventType, Instant timestamp, String toolEventId) {
        log.debug("Finding log details for toolType: {}, eventType: {}, timestamp: {}, toolEventId: {}",
                toolType, eventType, timestamp, toolEventId);

        Optional<LogDetails> details = toolEventLogRepository
                .find(tenantIdProvider.getTenantId(), toolType, eventType, timestamp, toolEventId)
                .map(this::mapToLogDetails);
        log.debug("Log details found: {}", details.isPresent());
        return details;
    }

    public LogFilters getLogFilters(LogFilterCriteria filters) {
        log.debug("Getting log filters with filter: {}", filters);
        LocalDate startDate = filters.getStartDate();
        LocalDate endDate = filters.getEndDate();
        List<String> toolTypes = filters.getToolTypes();
        List<String> eventTypes = filters.getEventTypes();
        List<String> severities = filters.getSeverities();
        List<String> organizationIds = filters.getOrganizationIds();

        String tenantId = tenantIdProvider.getTenantId();

        List<String> toolTypeOptions = pinotLogRepository.getToolTypeOptions(
                tenantId,
                startDate, endDate,
                toolTypes, eventTypes, severities, organizationIds);

        List<String> eventTypeOptions = pinotLogRepository.getEventTypeOptions(
                tenantId,
                startDate, endDate,
                toolTypes, eventTypes, severities, organizationIds);

        List<String> severityOptions = pinotLogRepository.getSeverityOptions(
                tenantId,
                startDate, endDate,
                toolTypes, eventTypes, severities, organizationIds);

        List<OrganizationOption> dataOptions = pinotLogRepository.getOrganizationOptions(
                tenantId,
                startDate, endDate,
                toolTypes, eventTypes, severities);

        List<OrganizationFilterOption> organizationOptions = dataOptions.stream()
                .map(opt -> OrganizationFilterOption.builder()
                        .id(opt.getId())
                        .name(opt.getName())
                        .build())
                .collect(Collectors.toList());

        return LogFilters.builder()
                .toolTypes(toolTypeOptions)
                .eventTypes(eventTypeOptions)
                .severities(severityOptions)
                .organizations(organizationOptions)
                .build();
    }


    private GenericQueryResult<LogEvent> buildLogQueryResult(List<LogProjection> logs, String cursor, int limit) {
        if (logs == null) {
            logs = new ArrayList<>();
        }
        boolean hasNextPage = logs.size() > limit;
        List<LogEvent> events = (hasNextPage ? logs.subList(0, limit) : logs).stream()
                .map(this::mapToLogEvent)
                .collect(Collectors.toList());

        PageInfo pageInfo = PageInfo.builder()
                .hasNextPage(hasNextPage)
                .hasPreviousPage(cursor != null)
                .startCursor(events.isEmpty() ? null : CursorCodec.encode(createLogCursor(events.getFirst())))
                .endCursor(events.isEmpty() ? null : CursorCodec.encode(createLogCursor(events.getLast())))
                .build();

        return GenericQueryResult.<LogEvent>builder()
                .items(events)
                .pageInfo(pageInfo)
                .build();
    }

    private String createLogCursor(LogEvent logEvent) {
        if (logEvent == null || logEvent.getTimestamp() == null) {
            return null;
        }
        return logEvent.getTimestamp().toEpochMilli() + "_" + logEvent.getToolEventId();
    }

    private LogEvent mapToLogEvent(LogProjection log) {
        return LogEvent.builder()
                .id(log.eventTimestamp.toEpochMilli() + "_" + log.toolEventId)
                .toolEventId(log.toolEventId)
                .ingestDay(log.ingestDay)
                .timestamp(log.eventTimestamp)
                .toolType(log.toolType)
                .eventType(log.eventType)
                .severity(log.severity)
                .summary(log.summary)
                .userId(log.userId)
                .deviceId(log.deviceId)
                .hostname(log.hostname)
                .nickname(log.nickname)
                .executionSource(log.executionSource)
                .scriptCreationSource(log.scriptCreationSource)
                .organizationId(log.organizationId)
                .organizationName(log.organizationName)
                .build();
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

    private String validateSortField(String field) {
        if (field == null || field.trim().isEmpty()) {
            return pinotLogRepository.getDefaultSortField();
        }
        String trimmedField = field.trim();
        if (!pinotLogRepository.isSortableField(trimmedField)) {
            log.warn("Invalid sort field requested for logs: {}, using default", field);
            return pinotLogRepository.getDefaultSortField();
        }
        return trimmedField;
    }
}
