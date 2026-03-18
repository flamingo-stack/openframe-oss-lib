package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.*;
import com.openframe.api.relay.GlobalId;
import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.event.*;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLEventMapper;
import com.openframe.api.service.EventService;
import com.openframe.data.document.event.Event;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;

import java.time.Instant;


@DgsComponent
@RequiredArgsConstructor
@Slf4j
@Validated
public class EventDataFetcher {

    private final EventService eventService;
    private final GraphQLEventMapper eventMapper;

    @DgsData(parentType = "Event", field = "id")
    public String eventNodeId(DgsDataFetchingEnvironment dfe) {
        Event event = dfe.getSource();
        return GlobalId.toGlobalId("Event", event.getId());
    }

    @DgsData(parentType = "Event", field = "rawId")
    public String eventRawId(DgsDataFetchingEnvironment dfe) {
        Event event = dfe.getSource();
        return event.getId();
    }

    @DgsQuery
    public GenericConnection<GenericEdge<Event>> events(
            @InputArgument @Valid EventFilterInput filter,
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before,
            @InputArgument String search,
            @InputArgument @Valid SortInput sort) {

        log.debug("Getting events with filter: {}, first: {}, after: {}, last: {}, before: {}, search: {}, sort: {}",
                filter, first, after, last, before, search, sort);

        EventFilterCriteria filterOptions = eventMapper.toEventFilterCriteria(filter);
        ConnectionArgs connectionArgs = ConnectionArgs.builder().first(first).after(after).last(last).before(before).build();
        CursorPaginationCriteria paginationCriteria = eventMapper.toCursorPaginationCriteria(connectionArgs);

        GenericQueryResult<Event> result = eventService.queryEvents(filterOptions, paginationCriteria, search, sort);
        GenericConnection<GenericEdge<Event>> connection = eventMapper.toEventConnection(result);

        log.debug("Successfully fetched {} events with cursor-based pagination",
                connection.getEdges().size());

        return connection;
    }

    @DgsQuery
    public Event eventById(@InputArgument @NotBlank String id) {
        log.debug("Getting event by ID: {}", id);
        return eventService.findById(id)
                .orElse(null);
    }

    @DgsQuery
    public EventFilters eventFilters(@InputArgument @Valid EventFilterInput filter) {
        log.debug("Getting event filters with filter: {}", filter);
        return eventService.getEventFilters();
    }

    @DgsMutation
    public Event createEvent(@InputArgument @Valid CreateEventInput input) {
        log.debug("Creating new event with input: {}", input);

        Event event = Event.builder()
                .userId(input.getUserId())
                .type(input.getType())
                .payload(input.getData())
                .timestamp(Instant.now())
                .build();

        return eventService.createEvent(event);
    }

    @DgsMutation
    public Event updateEvent(@InputArgument @NotBlank String id,
                             @InputArgument @Valid CreateEventInput input) {
        log.debug("Updating event with ID: {} and input: {}", id, input);

        Event event = Event.builder()
                .id(id)
                .userId(input.getUserId())
                .type(input.getType())
                .payload(input.getData())
                .build();

        return eventService.updateEvent(id, event);
    }
}
