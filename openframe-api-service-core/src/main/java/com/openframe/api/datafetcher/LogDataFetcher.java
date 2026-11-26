package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.*;
import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.audit.*;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLLogMapper;
import com.openframe.api.service.LogDetailsService;
import com.openframe.api.service.LogService;
import com.openframe.audit.AuditCall;
import com.openframe.audit.Audited;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.validation.annotation.Validated;

import java.time.Instant;
import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.AUDIT_LOG_EVENT_VIEW;
import static com.openframe.data.document.audit.AuditAction.AUDIT_LOG_VIEW;

@DgsComponent
@Slf4j
@Validated
@AllArgsConstructor
@ConditionalOnProperty(name = "openframe.tool-events.store")
public class LogDataFetcher {

    private final LogService logService;
    private final LogDetailsService logDetailsService;
    private final GraphQLLogMapper logMapper;
    private final AuditedMethodRunner auditedMethodRunner;

    @DgsQuery
    public LogFilters logFilters(@InputArgument @Valid LogFilterInput filter) {
        log.debug("Fetching audit filters with filter: {}", filter);

        LogFilterCriteria filterOptions = logMapper.toLogFilterCriteria(filter);
        return logService.getLogFilters(filterOptions);
    }

    @DgsQuery
    @Audited(action = AUDIT_LOG_VIEW, condition = "!T(org.springframework.util.StringUtils).hasText(#after)"
            + " && !T(org.springframework.util.StringUtils).hasText(#before)"
            + " && !T(org.springframework.util.StringUtils).hasText(#filter?.deviceId)",
            organizationId = "#filter?.organizationIds?.size() == 1 ? #filter.organizationIds[0] : null",
            details = {"startDate=#filter?.startDate", "endDate=#filter?.endDate",
                    "timestampFrom=#filter?.timestampFrom", "timestampTo=#filter?.timestampTo",
                    "eventTypes=#filter?.eventTypes", "toolTypes=#filter?.toolTypes", "severities=#filter?.severities",
                    "organizationIds=#filter?.organizationIds",
                    "search=T(org.springframework.util.StringUtils).hasText(#search) ? #search : null"})
    public GenericConnection<GenericEdge<LogEvent>> logs(
            @InputArgument @Valid LogFilterInput filter,
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before,
            @InputArgument String search,
            @InputArgument @Valid LogSortInput sort) {

        log.debug("Fetching logs with filter: {}, first: {}, after: {}, last: {}, before: {}, search: {}, sort: {}",
                filter, first, after, last, before, search, sort);

        LogFilterCriteria filterOptions = logMapper.toLogFilterCriteria(filter);
        ConnectionArgs connectionArgs = ConnectionArgs.builder().first(first).after(after).last(last).before(before).build();
        CursorPaginationCriteria paginationCriteria = logMapper.toCursorPaginationCriteria(connectionArgs);
        SortInput sortInput = logMapper.toSortInput(sort);

        var result = logService.queryLogs(filterOptions, paginationCriteria, search, sortInput);
        GenericConnection<GenericEdge<LogEvent>> connection = logMapper.toLogConnection(result);
        log.debug("Successfully fetched {} logs with cursor-based pagination",
                connection.getEdges().size());

        return connection;
    }

    @DgsQuery
    public LogDetails logDetails(
            @InputArgument @NotBlank String ingestDay,
            @InputArgument @NotBlank String toolType,
            @InputArgument @NotBlank String eventType,
            @InputArgument Instant timestamp,
            @InputArgument @NotBlank String toolEventId) {

        log.debug("Fetching audit details for ingestDay: {}, toolType: {}, eventType: {}, timestamp: {}, toolEventId: {}",
                ingestDay, toolType, eventType, timestamp, toolEventId);

        AuditCall auditCall = AuditCall.of(AUDIT_LOG_EVENT_VIEW, toolEventId,
                        Map.of("toolType", toolType, "eventType", eventType, "ingestDay", ingestDay))
                .withOrganizationIdOf(result -> result instanceof LogDetails found ? found.getOrganizationId() : null)
                .withDeviceIdOf(result -> result instanceof LogDetails found ? found.getDeviceId() : null);
        try {
            return auditedMethodRunner.run(auditCall, () -> requireLogDetails(ingestDay, toolType, eventType, timestamp, toolEventId));
        } catch (NotFoundException e) {
            log.debug("No audit details found for toolEventId: {}", toolEventId);
            return null;
        }
    }

    private LogDetails requireLogDetails(String ingestDay, String toolType, String eventType, Instant timestamp,
                                         String toolEventId) {
        return logDetailsService.findLogDetails(ingestDay, toolType, eventType, timestamp, toolEventId)
                .orElseThrow(() -> new NotFoundException(ErrorCode.LOG_NOT_FOUND, String.format(
                        "Log not found for toolEventId: %s, ingestDay: %s, toolType: %s, eventType: %s, timestamp: %s",
                        toolEventId, ingestDay, toolType, eventType, timestamp)));
    }
}
