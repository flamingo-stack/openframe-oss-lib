package com.openframe.api.mapper;

import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.audit.*;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.SortInput;
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
                .timestampFrom(input.getTimestampFrom())
                .timestampTo(input.getTimestampTo())
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

    /**
     * Convert the typed {@link LogSortInput} into the generic {@link SortInput}
     * consumed by the service layer. {@link LogSortField#TIMESTAMP} maps to the
     * underlying Pinot column {@code eventTimestamp}. Returns {@code null} when no
     * sort is provided so the service falls back to its default ordering.
     */
    public SortInput toSortInput(LogSortInput sort) {
        if (sort == null || sort.getField() == null) {
            return null;
        }
        String field = toSortField(sort.getField());
        return SortInput.builder()
                .field(field)
                .direction(sort.getDirection())
                .build();
    }

    private String toSortField(LogSortField field) {
        switch (field) {
            case TIMESTAMP:
            default:
                return "eventTimestamp";
        }
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