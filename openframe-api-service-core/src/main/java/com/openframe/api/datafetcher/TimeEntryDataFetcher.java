package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dataloader.OrganizationDataLoader;
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
import com.openframe.api.dto.timetracking.TimeEntryFilterInput;
import com.openframe.api.dto.timetracking.UpdateTimeEntryCommand;
import com.openframe.api.dto.timetracking.UpdateTimeEntryInput;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.ParsedRelayId;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.api.service.TimeEntryService;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.timetracking.TimeEntry;
import com.openframe.security.authentication.AuthPrincipal;
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

import static com.openframe.graphql.relay.NodeType.ORGANIZATION;
import static com.openframe.graphql.relay.NodeType.TICKET;
import static com.openframe.graphql.relay.NodeType.TIME_ENTRY;
import static com.openframe.graphql.relay.NodeType.USER;
import static org.springframework.util.StringUtils.hasText;

@DgsComponent
@Slf4j
@Validated
@RequiredArgsConstructor
public class TimeEntryDataFetcher {

    private static final String CLEARED_ID = "";

    private final TimeEntryService timeEntryService;
    private final RelayIdCodec relayIdCodec;

    @DgsQuery
    public TimeEntry currentTimer() {
        String userId = getCurrentUserId();
        log.debug("Loading current timer for user {}", userId);
        return timeEntryService.getCurrentTimer(userId).orElse(null);
    }

    @DgsQuery
    public TimeEntry timeEntry(@InputArgument @NotBlank String id) {
        String rawId = relayIdCodec.decode(id, TIME_ENTRY);
        return timeEntryService.getTimeEntry(rawId).orElse(null);
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<TimeEntry>> myTimeEntries(
            @InputArgument @Valid DateRangeInput period,
            @InputArgument String search,
            @InputArgument SortInput sort,
            @InputArgument Integer first,
            @InputArgument String after) {
        TimeEntryFilterInput filter = TimeEntryFilterInput.builder()
                .employeeIds(List.of(getCurrentUserId()))
                .startedFrom(period != null ? period.getStartDate().atStartOfDay().toInstant(ZoneOffset.UTC) : null)
                .startedTo(period != null ? period.getEndDate().atStartOfDay().toInstant(ZoneOffset.UTC) : null)
                .build();
        return queryEntries(filter, search, sort, first, after);
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<TimeEntry>> employeeTimeEntries(
            @InputArgument @Valid TimeEntryFilterInput filter,
            @InputArgument String search,
            @InputArgument SortInput sort,
            @InputArgument Integer first,
            @InputArgument String after) {
        decodeFilterIds(filter);
        return queryEntries(filter, search, sort, first, after);
    }

    @DgsQuery
    public EmployeeTimeStats employeeTimeStats(@InputArgument @Valid TimeEntryFilterInput filter) {
        decodeFilterIds(filter);
        return timeEntryService.getEmployeeTimeStats(filter);
    }

    @DgsMutation
    public TimeEntry startTimer(@InputArgument StartTimerInput input) {
        String userId = getCurrentUserId();
        log.info("startTimer mutation by user {}", userId);
        StartTimerCommand cmd = input == null ? null : toStartTimerCommand(input);
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
        StopTimerCommand cmd = input == null ? null : toStopTimerCommand(input);
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
        CreateTimeEntryCommand cmd = toCreateTimeEntryCommand(input);
        return timeEntryService.createTimeEntry(actingUserId, cmd);
    }

    @DgsMutation
    public TimeEntry updateTimeEntry(@InputArgument @Valid UpdateTimeEntryInput input) {
        String actingUserId = getCurrentUserId();
        UpdateTimeEntryCommand cmd = toUpdateTimeEntryCommand(input);
        return timeEntryService.updateTimeEntry(actingUserId, cmd);
    }

    @DgsMutation
    public TimeEntry unlinkTicketFromTimeEntry(@InputArgument @NotBlank String id) {
        String actingUserId = getCurrentUserId();
        String rawId = relayIdCodec.decode(id, TIME_ENTRY);
        return timeEntryService.unlinkTicketFromTimeEntry(actingUserId, rawId);
    }

    @DgsMutation
    public boolean deleteTimeEntry(@InputArgument @NotBlank String id) {
        String actingUserId = getCurrentUserId();
        String rawId = relayIdCodec.decode(id, TIME_ENTRY);
        return timeEntryService.deleteTimeEntry(actingUserId, rawId);
    }

    @DgsData(parentType = "TimeEntry", field = "state")
    public String timeEntryState(DgsDataFetchingEnvironment dfe) {
        TimeEntry entry = dfe.getSource();
        if (entry.getEndedAt() != null) return "COMPLETED";
        if (entry.getPausedAt() != null) return "PAUSED";
        return "RUNNING";
    }

    @DgsData(parentType = "TimeEntry", field = "user")
    public CompletableFuture<UserResponse> timeEntryUser(DgsDataFetchingEnvironment dfe) {
        TimeEntry entry = dfe.getSource();
        if (entry.getUserId() == null) {
            return CompletableFuture.completedFuture(null);
        }
        DataLoader<String, UserResponse> loader = dfe.getDataLoader("userDataLoader");
        return loader.load(entry.getUserId());
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

    @DgsData(parentType = "TimeEntry", field = "organization")
    public CompletableFuture<Organization> timeEntryOrganization(DgsDataFetchingEnvironment dfe) {
        TimeEntry entry = dfe.getSource();
        if (entry.getOrganizationId() == null) {
            return CompletableFuture.completedFuture(null);
        }
        DataLoader<String, Organization> loader = dfe.getDataLoader(OrganizationDataLoader.NAME);
        return loader.load(entry.getOrganizationId());
    }

    private CountedGenericConnection<GenericEdge<TimeEntry>> queryEntries(
            TimeEntryFilterInput filter, String search, SortInput sort, Integer first, String after) {
        CursorPaginationCriteria pagination = CursorPaginationCriteria.fromConnectionArgs(
                ConnectionArgs.builder().first(first).after(after).build());
        CountedGenericQueryResult<TimeEntry> result =
                timeEntryService.queryEntries(filter, search, pagination, sort);
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

    private void decodeFilterIds(TimeEntryFilterInput filter) {
        if (filter == null) {
            return;
        }
        List<String> employeeGlobalIds = filter.getEmployeeIds();
        List<String> organizationGlobalIds = filter.getOrganizationIds();
        List<String> employeeIds = relayIdCodec.decodeAll(employeeGlobalIds, USER);
        List<String> organizationIds = relayIdCodec.decodeAll(organizationGlobalIds, ORGANIZATION);
        filter.setEmployeeIds(employeeIds);
        filter.setOrganizationIds(organizationIds);
    }

    private StartTimerCommand toStartTimerCommand(StartTimerInput input) {
        String ticketGlobalId = input.getTicketId();
        String organizationGlobalId = input.getOrganizationId();
        String ticketId = decodeClearable(ticketGlobalId, TICKET);
        String organizationId = decodeClearable(organizationGlobalId, ORGANIZATION);
        return StartTimerCommand.builder()
                .ticketId(ticketId)
                .organizationId(organizationId)
                .notes(input.getNotes())
                .build();
    }

    private StopTimerCommand toStopTimerCommand(StopTimerInput input) {
        String ticketGlobalId = input.getTicketId();
        String organizationGlobalId = input.getOrganizationId();
        String ticketId = decodeClearable(ticketGlobalId, TICKET);
        String organizationId = decodeClearable(organizationGlobalId, ORGANIZATION);
        return StopTimerCommand.builder()
                .ticketId(ticketId)
                .organizationId(organizationId)
                .notes(input.getNotes())
                .build();
    }

    private CreateTimeEntryCommand toCreateTimeEntryCommand(CreateTimeEntryInput input) {
        String userGlobalId = input.getUserId();
        String ticketGlobalId = input.getTicketId();
        String organizationGlobalId = input.getOrganizationId();
        String userId = relayIdCodec.decode(userGlobalId, USER);
        String ticketId = decodeClearable(ticketGlobalId, TICKET);
        String organizationId = decodeClearable(organizationGlobalId, ORGANIZATION);
        return CreateTimeEntryCommand.builder()
                .userId(userId)
                .ticketId(ticketId)
                .organizationId(organizationId)
                .notes(input.getNotes())
                .startedAt(input.getStartedAt())
                .durationSeconds(input.getDurationSeconds())
                .build();
    }

    private UpdateTimeEntryCommand toUpdateTimeEntryCommand(UpdateTimeEntryInput input) {
        String entryGlobalId = input.getId();
        String userGlobalId = input.getUserId();
        String ticketGlobalId = input.getTicketId();
        String organizationGlobalId = input.getOrganizationId();
        String entryId = relayIdCodec.decode(entryGlobalId, TIME_ENTRY);
        String userId = relayIdCodec.decode(userGlobalId, USER);
        String ticketId = decodeClearable(ticketGlobalId, TICKET);
        String organizationId = decodeClearable(organizationGlobalId, ORGANIZATION);
        return UpdateTimeEntryCommand.builder()
                .id(entryId)
                .userId(userId)
                .ticketId(ticketId)
                .organizationId(organizationId)
                .notes(input.getNotes())
                .startedAt(input.getStartedAt())
                .durationSeconds(input.getDurationSeconds())
                .build();
    }

    // The web clears a link by sending toGlobalId(type, ''); mobile and desktop ship that bundle frozen.
    private String decodeClearable(String id, NodeType type) {
        if (isClearSentinel(id, type)) {
            return CLEARED_ID;
        }
        return relayIdCodec.decode(id, type);
    }

    private boolean isClearSentinel(String id, NodeType type) {
        return relayIdCodec.parse(id)
                .filter(parsed -> parsed.isOfType(type))
                .map(ParsedRelayId::getRawId)
                .filter(rawId -> !hasText(rawId))
                .isPresent();
    }
}
