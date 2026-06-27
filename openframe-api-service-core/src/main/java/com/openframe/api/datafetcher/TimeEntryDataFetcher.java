package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.timetracking.CreateTimeEntryCommand;
import com.openframe.api.dto.timetracking.CreateTimeEntryInput;
import com.openframe.api.dto.timetracking.DateRangeInput;
import com.openframe.api.dto.timetracking.EmployeeTimeStats;
import com.openframe.api.dto.timetracking.StartTimerCommand;
import com.openframe.api.dto.timetracking.StartTimerInput;
import com.openframe.api.dto.timetracking.StopTimerCommand;
import com.openframe.api.dto.timetracking.StopTimerInput;
import com.openframe.api.dto.timetracking.UpdateTimeEntryCommand;
import com.openframe.api.dto.timetracking.UpdateTimeEntryInput;
import com.openframe.api.service.TimeEntryService;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.timetracking.TimeEntry;
import com.openframe.data.document.timetracking.filter.TimeEntryQueryFilter;
import com.openframe.data.document.timetracking.filter.TimeEntryStateFilter;
import com.openframe.security.authentication.AuthPrincipal;
import graphql.relay.Relay;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dataloader.DataLoader;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@DgsComponent
@Slf4j
@Validated
@RequiredArgsConstructor
public class TimeEntryDataFetcher {

    private static final Relay RELAY = new Relay();

    private final TimeEntryService timeEntryService;

    @DgsQuery
    public TimeEntry currentTimer() {
        String userId = getCurrentUserId();
        log.debug("Loading current timer for user {}", userId);
        return timeEntryService.getCurrentTimer(userId).orElse(null);
    }

    @DgsQuery
    public TimeEntry timeEntry(@InputArgument @NotBlank String id) {
        String rawId = RELAY.fromGlobalId(id).getId();
        return timeEntryService.getEntry(rawId).orElse(null);
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<TimeEntry>> myTimeEntries(
            @InputArgument @Valid DateRangeInput period,
            @InputArgument String search,
            @InputArgument SortInput sort,
            @InputArgument Integer first,
            @InputArgument String after) {
        String userId = getCurrentUserId();
        return queryEntries(List.of(userId), period, search, sort, first, after);
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<TimeEntry>> employeeTimeEntries(
            @InputArgument @NotBlank String employeeId,
            @InputArgument @Valid DateRangeInput period,
            @InputArgument String search,
            @InputArgument SortInput sort,
            @InputArgument Integer first,
            @InputArgument String after) {
        String rawId = RELAY.fromGlobalId(employeeId).getId();
        return queryEntries(List.of(rawId), period, search, sort, first, after);
    }

    @DgsQuery
    public EmployeeTimeStats employeeTimeStats(
            @InputArgument @NotBlank String employeeId,
            @InputArgument @Valid DateRangeInput period) {
        String rawId = RELAY.fromGlobalId(employeeId).getId();
        Instant from = period != null ? period.getStartDate().atStartOfDay().toInstant(ZoneOffset.UTC) : null;
        Instant to = period != null ? period.getEndDate().atStartOfDay().toInstant(ZoneOffset.UTC) : null;
        return timeEntryService.getEmployeeStats(rawId, from, to);
    }

    @DgsMutation
    public TimeEntry startTimer(@InputArgument StartTimerInput input) {
        String userId = getCurrentUserId();
        log.info("startTimer mutation by user {}", userId);
        StartTimerCommand cmd = input == null ? null : StartTimerCommand.builder()
                .ticketId(input.getTicketId() != null ? RELAY.fromGlobalId(input.getTicketId()).getId() : null)
                .notes(input.getNotes())
                .build();
        return timeEntryService.startTimer(userId, cmd);
    }

    @DgsMutation
    public TimeEntry pauseTimer() {
        String userId = getCurrentUserId();
        log.info("pauseTimer mutation by user {}", userId);
        return timeEntryService.pauseTimer(userId);
    }

    @DgsMutation
    public TimeEntry resumeTimer() {
        String userId = getCurrentUserId();
        log.info("resumeTimer mutation by user {}", userId);
        return timeEntryService.resumeTimer(userId);
    }

    @DgsMutation
    public TimeEntry stopTimer(@InputArgument StopTimerInput input) {
        String userId = getCurrentUserId();
        log.info("stopTimer mutation by user {}", userId);
        StopTimerCommand cmd = input == null ? null : StopTimerCommand.builder()
                .ticketId(input.getTicketId() != null ? RELAY.fromGlobalId(input.getTicketId()).getId() : null)
                .notes(input.getNotes())
                .build();
        return timeEntryService.stopTimer(userId, cmd);
    }

    @DgsMutation
    public boolean cancelTimer() {
        String userId = getCurrentUserId();
        log.info("cancelTimer mutation by user {}", userId);
        return timeEntryService.cancelTimer(userId);
    }

    @DgsMutation
    public TimeEntry createTimeEntry(@InputArgument @Valid CreateTimeEntryInput input) {
        String actingUserId = getCurrentUserId();
        CreateTimeEntryCommand cmd = CreateTimeEntryCommand.builder()
                .userId(RELAY.fromGlobalId(input.getUserId()).getId())
                .ticketId(input.getTicketId() != null ? RELAY.fromGlobalId(input.getTicketId()).getId() : null)
                .notes(input.getNotes())
                .startedAt(input.getStartedAt())
                .durationSeconds(input.getDurationSeconds())
                .build();
        return timeEntryService.createEntry(actingUserId, cmd);
    }

    @DgsMutation
    public TimeEntry updateTimeEntry(@InputArgument @Valid UpdateTimeEntryInput input) {
        String actingUserId = getCurrentUserId();
        UpdateTimeEntryCommand cmd = UpdateTimeEntryCommand.builder()
                .id(RELAY.fromGlobalId(input.getId()).getId())
                .ticketId(input.getTicketId() != null ? RELAY.fromGlobalId(input.getTicketId()).getId() : null)
                .notes(input.getNotes())
                .startedAt(input.getStartedAt())
                .durationSeconds(input.getDurationSeconds())
                .build();
        return timeEntryService.updateEntry(actingUserId, cmd);
    }

    @DgsMutation
    public TimeEntry unlinkTicketFromTimeEntry(@InputArgument @NotBlank String id) {
        String actingUserId = getCurrentUserId();
        return timeEntryService.unlinkTicket(actingUserId, RELAY.fromGlobalId(id).getId());
    }

    @DgsMutation
    public boolean deleteTimeEntry(@InputArgument @NotBlank String id) {
        String actingUserId = getCurrentUserId();
        return timeEntryService.deleteEntry(actingUserId, RELAY.fromGlobalId(id).getId());
    }

    @DgsData(parentType = "TimeEntry", field = "id")
    public String timeEntryNodeId(DgsDataFetchingEnvironment dfe) {
        TimeEntry entry = dfe.getSource();
        return RELAY.toGlobalId("TimeEntry", entry.getId());
    }

    @DgsData(parentType = "TimeEntry", field = "state")
    public String timeEntryState(DgsDataFetchingEnvironment dfe) {
        TimeEntry entry = dfe.getSource();
        if (entry.getEndedAt() != null) return "COMPLETED";
        if (entry.getPausedAt() != null) return "PAUSED";
        return "RUNNING";
    }

    @DgsData(parentType = "TimeEntry", field = "ticket")
    public CompletableFuture<Ticket> timeEntryTicket(DgsDataFetchingEnvironment dfe) {
        TimeEntry entry = dfe.getSource();
        if (entry.getTicketId() == null) {
            return CompletableFuture.completedFuture(null);
        }
        DataLoader<String, Ticket> loader = dfe.getDataLoader("ticketDataLoader");
        return loader.load(entry.getTicketId());
    }

    private CountedGenericConnection<GenericEdge<TimeEntry>> queryEntries(
            List<String> userIds, DateRangeInput period, String search,
            SortInput sort, Integer first, String after) {

        TimeEntryQueryFilter.TimeEntryQueryFilterBuilder filter = TimeEntryQueryFilter.builder()
                .userIds(userIds)
                .search(search)
                .state(TimeEntryStateFilter.COMPLETED);
        if (period != null) {
            filter.startedFrom(period.getStartDate().atStartOfDay().toInstant(ZoneOffset.UTC));
            filter.startedTo(period.getEndDate().atStartOfDay().toInstant(ZoneOffset.UTC));
        }

        CursorPaginationCriteria pagination = CursorPaginationCriteria.fromConnectionArgs(
                ConnectionArgs.builder().first(first).after(after).build());

        CountedGenericQueryResult<TimeEntry> result =
                timeEntryService.queryEntries(filter.build(), pagination, sort);

        return toConnection(result);
    }

    private CountedGenericConnection<GenericEdge<TimeEntry>> toConnection(CountedGenericQueryResult<TimeEntry> result) {
        List<GenericEdge<TimeEntry>> edges = result.getItems().stream()
                .map(e -> GenericEdge.<TimeEntry>builder()
                        .node(e)
                        .cursor(CursorCodec.encode(e.getId()))
                        .build())
                .toList();
        return CountedGenericConnection.<GenericEdge<TimeEntry>>builder()
                .edges(edges)
                .pageInfo(result.getPageInfo())
                .filteredCount(result.getFilteredCount())
                .build();
    }

    private String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return AuthPrincipal.fromJwt((Jwt) auth.getPrincipal()).getId();
    }
}
