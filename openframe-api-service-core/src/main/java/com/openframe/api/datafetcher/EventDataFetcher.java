package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.*;
import graphql.relay.Relay;
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

    private static final Relay RELAY = new Relay();

    private final EventService eventService;
    private final GraphQLEventMapper eventMapper;

    @DgsData(parentType = "Event", field = "id")
    public String eventNodeId(DgsDataFetchingEnvironment dfe) {
        Event event = dfe.getSource();
        return RELAY.toGlobalId("Event", event.getId());
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
        String rawId = RELAY.fromGlobalId(id).getId();
        log.debug("Getting event by global ID: {}, rawId: {}", id, rawId);
        return eventService.findById(rawId)
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
        String rawId = RELAY.fromGlobalId(id).getId();
        log.debug("Updating event with global ID: {}, rawId: {} and input: {}", id, rawId, input);

        Event event = Event.builder()
                .id(rawId)
                .userId(input.getUserId())
                .type(input.getType())
                .payload(input.getData())
                .build();

        return eventService.updateEvent(rawId, event);
    }
}
