package com.openframe.external.mapper;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.audit.LogEvent;
import com.openframe.api.dto.audit.LogFilters;
import com.openframe.api.dto.audit.LogDetails;
import com.openframe.external.dto.audit.LogResponse;
import com.openframe.external.dto.audit.LogsResponse;
import com.openframe.external.dto.audit.LogFilterResponse;
import com.openframe.external.dto.audit.LogDetailsResponse;
import com.openframe.external.dto.audit.CustomerFilterResponse;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class LogMapper extends BaseRestMapper {


    public LogResponse toLogResponse(LogEvent logEvent) {
        if (logEvent == null) {
            return null;
        }

        return LogResponse.builder()
                .toolEventId(logEvent.getToolEventId())
                .eventType(logEvent.getEventType())
                .ingestDay(logEvent.getIngestDay())
                .toolType(logEvent.getToolType())
                .severity(logEvent.getSeverity())
                .userId(logEvent.getUserId())
                .deviceId(logEvent.getDeviceId())
                .hostname(logEvent.getHostname())
                .customerId(logEvent.getOrganizationId())
                .customerName(logEvent.getOrganizationName())
                .summary(logEvent.getSummary())
                .timestamp(logEvent.getTimestamp())
                .build();
    }


    public LogsResponse toLogsResponse(GenericQueryResult<LogEvent> result) {
        if (result == null) {
            return LogsResponse.builder()
                    .logs(List.of())
                    .pageInfo(null)
                    .build();
        }

        List<LogResponse> logs = result.getItems().stream()
                .map(this::toLogResponse)
                .collect(Collectors.toList());

        return LogsResponse.builder()
                .logs(logs)
                .pageInfo(result.getPageInfo())
                .build();
    }

    public LogFilterResponse toLogFilterResponse(LogFilters filters) {
        if (filters == null) {
            return LogFilterResponse.builder().build();
        }

        List<CustomerFilterResponse> customers = filters.getOrganizations().stream()
                .map(org -> new CustomerFilterResponse(org.getId(), org.getName()))
                .collect(Collectors.toList());

        return LogFilterResponse.builder()
                .toolTypes(filters.getToolTypes())
                .eventTypes(filters.getEventTypes())
                .severities(filters.getSeverities())
                .customers(customers)
                .build();
    }


    public LogDetailsResponse toLogDetailsResponse(LogDetails logDetails) {
        if (logDetails == null) {
            return null;
        }
        
        return LogDetailsResponse.builder()
                .toolEventId(logDetails.getToolEventId())
                .eventType(logDetails.getEventType())
                .ingestDay(logDetails.getIngestDay())
                .toolType(logDetails.getToolType())
                .severity(logDetails.getSeverity())
                .userId(logDetails.getUserId())
                .deviceId(logDetails.getDeviceId())
                .hostname(logDetails.getHostname())
                .customerId(logDetails.getOrganizationId())
                .customerName(logDetails.getOrganizationName())
                .summary(logDetails.getSummary())
                .message(logDetails.getMessage())
                .content(logDetails.getDetails())
                .timestamp(logDetails.getTimestamp())
                .build();
    }
}