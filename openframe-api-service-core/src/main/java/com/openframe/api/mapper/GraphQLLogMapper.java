package com.openframe.api.mapper;

import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.audit.*;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.ConnectionArgs;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class GraphQLLogMapper {

    public LogFilterCriteria toLogFilterCriteria(LogFilterInput input) {
        if (input == null) {
            return LogFilterCriteria.builder().build();
        }

        return LogFilterCriteria.builder()
                .startDate(input.getStartDate())
                .endDate(input.getEndDate())
                .eventTypes(input.getEventTypes())
                .toolTypes(input.getToolTypes())
                .severities(input.getSeverities())
                .organizationIds(input.getOrganizationIds())
                .deviceId(input.getDeviceId())
                .build();
    }

    public CursorPaginationCriteria toCursorPaginationCriteria(ConnectionArgs args) {
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    public GenericConnection<GenericEdge<LogEvent>> toLogConnection(GenericQueryResult<LogEvent> result) {
        List<GenericEdge<LogEvent>> edges = result.getItems().stream()
                .map(logEvent -> GenericEdge.<LogEvent>builder()
                        .node(logEvent)
                        .cursor(CursorCodec.encode(createLogCursor(logEvent)))
                        .build())
                .collect(Collectors.toList());

        return GenericConnection.<GenericEdge<LogEvent>>builder()
                .edges(edges)
                .pageInfo(result.getPageInfo())
                .build();
    }

    private String createLogCursor(LogEvent event) {
        if (event == null || event.getTimestamp() == null) {
            return null;
        }
        return event.getTimestamp().toEpochMilli() + "_" + event.getToolEventId();
    }
}