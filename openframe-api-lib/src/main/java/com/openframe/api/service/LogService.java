package com.openframe.api.service;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.audit.*;
import com.openframe.api.dto.shared.CursorPage;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.pinot.model.LogProjection;
import com.openframe.data.pinot.model.LogSortPosition;
import com.openframe.data.pinot.model.OrganizationOption;
import com.openframe.data.pinot.repository.PinotLogRepository;
import com.openframe.data.repository.cursor.CursorPosition;
import com.openframe.data.repository.cursor.KeysetCursor;
import com.openframe.data.service.TenantIdProvider;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Slf4j
@AllArgsConstructor
@ConditionalOnProperty(name = "openframe.tool-events.store")
public class LogService {

    private static final String EVENT_TIMESTAMP_SORT = "eventTimestamp";
    private static final String OLDER_CURSOR_SEPARATOR = "_";

    private final PinotLogRepository pinotLogRepository;
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

        int limit = normalizedCriteria.getLimit();
        boolean backward = normalizedCriteria.isBackward();

        List<String> organizationIds = filter.getOrganizationIds();
        String deviceId = filter.getDeviceId();

        String sortField = validateSortField(sort != null ? sort.getField() : null);
        String sortDirection = (sort != null && sort.getDirection() != null) ?
            sort.getDirection().name() : "DESC";
        Sort.Direction direction = Sort.Direction.valueOf(sortDirection);
        String decodedCursor = normalizedCriteria.getCursor();
        LogSortPosition position = sortPosition(decodedCursor, sortField, direction).orElse(null);

        if (search != null && !search.trim().isEmpty()) {
            log.debug("Using search functionality with term: {}", search);
            logs = pinotLogRepository.searchLogs(
                    tenantIdProvider.getTenantId(),
                    startDate, endDate,
                    timestampFrom, timestampTo,
                    toolTypes, eventTypes, severities,
                    organizationIds, deviceId,
                    search, position, limit + 1,
                    sortField, sortDirection, backward);
        } else {
            log.debug("Using exact field filtering");
            logs = pinotLogRepository.findLogs(
                    tenantIdProvider.getTenantId(),
                    startDate, endDate,
                    timestampFrom, timestampTo,
                    toolTypes, eventTypes, severities,
                    organizationIds, deviceId,
                    position, limit + 1,
                    sortField, sortDirection, backward);
        }

        log.debug("Retrieved {} logs from Pinot", logs != null ? logs.size() : 0);

        GenericQueryResult<LogEvent> result = buildLogQueryResult(logs, normalizedCriteria, sortField, direction);

        log.debug("Successfully built result with {} events", result.getItems().size());
        return result;
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


    private GenericQueryResult<LogEvent> buildLogQueryResult(List<LogProjection> logs, CursorPaginationCriteria criteria,
                                                             String sortField, Sort.Direction direction) {
        List<LogProjection> fetched = logs == null ? List.of() : logs;
        CursorPage<LogProjection> page = CursorPage.assemble(fetched, criteria);
        List<LogProjection> rows = page.items();
        List<LogEvent> events = rows.stream()
                .map(this::mapToLogEvent)
                .collect(Collectors.toList());
        String startCursor = rows.isEmpty() ? null : pageCursor(rows.getFirst(), sortField, direction);
        String endCursor = rows.isEmpty() ? null : pageCursor(rows.getLast(), sortField, direction);

        PageInfo pageInfo = PageInfo.builder()
                .hasNextPage(page.hasNextPage())
                .hasPreviousPage(page.hasPreviousPage())
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();

        return GenericQueryResult.<LogEvent>builder()
                .items(events)
                .pageInfo(pageInfo)
                .build();
    }

    private String pageCursor(LogProjection row, String sortField, Sort.Direction direction) {
        LogSortPosition position = pinotLogRepository.sortPositionOf(row, sortField);
        String toolEventId = position.getToolEventId();
        if (position.isTimestamp()) {
            long timestampMillis = position.getTimestampMillis();
            Instant timestamp = Instant.ofEpochMilli(timestampMillis);
            return KeysetCursor.ofInstant(sortField, direction, timestamp, toolEventId).encode();
        }
        String textValue = position.getTextValue();
        return KeysetCursor.ofString(sortField, direction, textValue, toolEventId).encode();
    }

    private Optional<LogSortPosition> sortPosition(String decodedCursor, String sortField, Sort.Direction direction) {
        CursorPosition cursorPosition = KeysetCursor.parseDecoded(decodedCursor);
        return switch (cursorPosition) {
            case CursorPosition.None _ -> Optional.empty();
            case KeysetCursor keyset -> {
                LogSortPosition position = keysetPosition(keyset, sortField, direction);
                yield Optional.of(position);
            }
            case CursorPosition.Unrecognised(String olderCursor) -> {
                LogSortPosition position = olderCursorPosition(olderCursor, sortField);
                yield Optional.of(position);
            }
            case CursorPosition.RowId _ -> throw new InvalidCursorException();
        };
    }

    private LogSortPosition keysetPosition(KeysetCursor keyset, String sortField, Sort.Direction direction) {
        keyset.requireSort(sortField, direction);
        if (keyset.hasNullValue()) {
            throw new InvalidCursorException();
        }
        String toolEventId = keyset.id();
        if (EVENT_TIMESTAMP_SORT.equals(sortField)) {
            long timestampMillis = keyset.instantValue().toEpochMilli();
            return LogSortPosition.ofTimestamp(timestampMillis, toolEventId);
        }
        String textValue = keyset.stringValue();
        return LogSortPosition.ofText(textValue, toolEventId);
    }

    private LogSortPosition olderCursorPosition(String decodedCursor, String sortField) {
        int separator = decodedCursor.indexOf(OLDER_CURSOR_SEPARATOR);
        if (!EVENT_TIMESTAMP_SORT.equals(sortField) || separator < 0) {
            throw new InvalidCursorException();
        }
        String timestampText = decodedCursor.substring(0, separator);
        String toolEventId = decodedCursor.substring(separator + 1);
        if (toolEventId.isBlank()) {
            throw new InvalidCursorException();
        }
        try {
            long timestampMillis = Long.parseLong(timestampText);
            return LogSortPosition.ofTimestamp(timestampMillis, toolEventId);
        } catch (NumberFormatException e) {
            throw new InvalidCursorException(e);
        }
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
