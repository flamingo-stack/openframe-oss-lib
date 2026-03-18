package com.openframe.api.mapper;

import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.event.*;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.data.document.event.Event;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class GraphQLEventMapper {

    public EventFilterCriteria toEventFilterCriteria(EventFilterInput input) {
        if (input == null) {
            return EventFilterCriteria.builder().build();
        }

        return EventFilterCriteria.builder()
                .userIds(input.getUserIds())
                .eventTypes(input.getEventTypes())
                .startDate(input.getStartDate())
                .endDate(input.getEndDate())
                .build();
    }

    public CursorPaginationCriteria toCursorPaginationCriteria(ConnectionArgs args) {
        return CursorPaginationCriteria.fromConnectionArgs(args);
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
                        .cursor(CursorCodec.encode(event.getId()))
                        .build())
                .collect(Collectors.toList());

        return GenericConnection.<GenericEdge<Event>>builder()
                .edges(edges)
                .pageInfo(result.getPageInfo())
                .build();
    }
}