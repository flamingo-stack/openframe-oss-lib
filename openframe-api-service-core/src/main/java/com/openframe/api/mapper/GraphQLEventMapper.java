package com.openframe.api.mapper;

import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.event.*;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.CursorPaginationInput;
import com.openframe.data.document.event.Event;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class GraphQLEventMapper {

    public EventFilterOptions toEventFilterOptions(EventFilterInput input) {
        if (input == null) {
            return EventFilterOptions.builder().build();
        }

        return EventFilterOptions.builder()
                .userIds(input.getUserIds())
                .eventTypes(input.getEventTypes())
                .startDate(input.getStartDate())
                .endDate(input.getEndDate())
                .build();
    }

    public CursorPaginationCriteria toCursorPaginationCriteria(CursorPaginationInput input) {
        if (input == null) {
            return CursorPaginationCriteria.builder().build();
        }

        return CursorPaginationCriteria.builder()
                .limit(input.getLimit())
                .cursor(input.getCursor())
                .build();
    }

    public GenericConnection<GenericEdge<Event>> toEventConnection(GenericQueryResult<Event> result) {
        if (result == null) {
            return GenericConnection.<GenericEdge<Event>>builder()
                    .edges(List.of())
                    .pageInfo(null)
                    .build();
        }

        List<GenericEdge<Event>> edges = result.getItems().stream()
                .map(event -> GenericEdge.<Event>builder()
                        .node(event)
                        .cursor(event.getId())
                        .build())
                .collect(Collectors.toList());

        return GenericConnection.<GenericEdge<Event>>builder()
                .edges(edges)
                .pageInfo(result.getPageInfo())
                .build();
    }
}