package com.openframe.api.service;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.timetracking.CreateTimeEntryCommand;
import com.openframe.api.dto.timetracking.EmployeeTimeStats;
import com.openframe.api.dto.timetracking.StartTimerCommand;
import com.openframe.api.dto.timetracking.StopTimerCommand;
import com.openframe.api.dto.timetracking.TimeEntryFilterInput;
import com.openframe.api.dto.timetracking.UpdateTimeEntryCommand;
import com.openframe.api.exception.TimeEntryNotFoundException;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;
import com.openframe.core.exception.ValidationException;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatus;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.document.timetracking.TimeEntry;
import com.openframe.data.document.timetracking.TimeEntrySource;
import com.openframe.data.document.timetracking.filter.TimeEntryQueryFilter;
import com.openframe.data.document.timetracking.filter.TimeEntryStateFilter;
import com.openframe.data.repository.timetracking.TimeEntryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Service
@Slf4j
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TimeEntryService {

    private final TimeEntryRepository timeEntryRepository;
    private final TicketQueryService ticketQueryService;

    public Optional<TimeEntry> getCurrentTimer(String userId) {
        return timeEntryRepository.findByUserIdAndEndedAtIsNull(userId);
    }

    public Optional<TimeEntry> getTimeEntry(String entryId) {
        return timeEntryRepository.findById(entryId);
    }

    @Transactional
    public TimeEntry startTimer(String userId, StartTimerCommand cmd) {
        log.info("Starting timer for user {}", userId);

        String ticketId = cmd != null ? cmd.getTicketId() : null;
        Ticket ticket = ticketId != null ? requireActiveTicket(ticketId) : null;

        TimeEntry entry = TimeEntry.builder()
                .userId(userId)
                .ticketId(ticketId)
                .ticketNumber(ticket != null ? ticket.getTicketNumber() : null)
                .ticketTitle(ticket != null ? ticket.getTitle() : null)
                .organizationId(resolveOrganizationId(ticket, cmd != null ? cmd.getOrganizationId() : null))
                .notes(cmd != null ? cmd.getNotes() : null)
                .startedAt(Instant.now())
                .source(TimeEntrySource.TIMER)
                .createdBy(userId)
                .lastModifiedBy(userId)
                .build();

        try {
            return timeEntryRepository.save(entry);
        } catch (DuplicateKeyException e) {
            throw new ConflictException(ErrorCode.TIME_ENTRY_ACTIVE_EXISTS,
                    "User already has an active timer");
        }
    }

    @Transactional
    public TimeEntry pauseTimer(String userId) {
        log.info("Pausing timer for user {}", userId);
        TimeEntry entry = requireActiveTimer(userId);
        if (entry.getPausedAt() != null) {
            return entry;
        }
        entry.setPausedAt(Instant.now());
        entry.setLastModifiedBy(userId);
        return timeEntryRepository.save(entry);
    }

    @Transactional
    public TimeEntry resumeTimer(String userId) {
        log.info("Resuming timer for user {}", userId);
        TimeEntry entry = requireActiveTimer(userId);
        if (entry.getPausedAt() == null) {
            return entry;
        }
        long pauseSeconds = secondsBetween(entry.getPausedAt(), Instant.now());
        entry.setBreakSeconds(entry.getBreakSeconds() + pauseSeconds);
        entry.setPausedAt(null);
        entry.setLastModifiedBy(userId);
        return timeEntryRepository.save(entry);
    }

    @Transactional
    public TimeEntry stopTimer(String userId, StopTimerCommand cmd) {
        log.info("Stopping timer for user {}", userId);
        TimeEntry entry = requireActiveTimer(userId);
        Instant now = Instant.now();

        if (entry.getPausedAt() != null) {
            entry.setBreakSeconds(entry.getBreakSeconds() + secondsBetween(entry.getPausedAt(), now));
            entry.setPausedAt(null);
        }

        Ticket ticket = null;
        boolean ticketChanged = false;
        if (cmd != null) {
            if (cmd.getTicketId() != null) {
                String normalized = cmd.getTicketId().isBlank() ? null : cmd.getTicketId();
                ticket = normalized != null ? requireActiveTicket(normalized) : null;
                populateTicketReference(entry, ticket);
                ticketChanged = true;
            }
            if (cmd.getNotes() != null) {
                entry.setNotes(cmd.getNotes().isBlank() ? null : cmd.getNotes());
            }
        }
        applyOrganizationChange(entry, cmd != null ? cmd.getOrganizationId() : null, ticket, ticketChanged);

        requireTicketOrNotes(entry.getTicketId(), entry.getNotes());

        long elapsed = secondsBetween(entry.getStartedAt(), now);
        entry.setDurationSeconds(Math.max(0L, elapsed - entry.getBreakSeconds()));
        entry.setEndedAt(now);
        entry.setLastModifiedBy(userId);
        return timeEntryRepository.save(entry);
    }

    @Transactional
    public boolean cancelTimer(String userId) {
        log.info("Cancelling timer for user {}", userId);
        Optional<TimeEntry> active = timeEntryRepository.findByUserIdAndEndedAtIsNull(userId);
        if (active.isEmpty()) return false;
        timeEntryRepository.delete(active.get());
        return true;
    }

    @Transactional
    public TimeEntry createTimeEntry(String actingUserId, CreateTimeEntryCommand cmd) {
        log.info("Creating time entry for user {} by {}", cmd.getUserId(), actingUserId);
        if (cmd.getUserId() == null) {
            throw new ValidationException("userId is required");
        }
        requireTicketOrNotes(cmd.getTicketId(), cmd.getNotes());
        if (cmd.getDurationSeconds() <= 0) {
            throw new ValidationException("Duration must be positive");
        }
        if (cmd.getStartedAt() == null) {
            throw new ValidationException("startedAt is required");
        }
        Ticket ticket = cmd.getTicketId() != null ? requireActiveTicket(cmd.getTicketId()) : null;

        Instant endedAt = cmd.getStartedAt().plusSeconds(cmd.getDurationSeconds());
        TimeEntry entry = TimeEntry.builder()
                .userId(cmd.getUserId())
                .ticketId(cmd.getTicketId())
                .ticketNumber(ticket != null ? ticket.getTicketNumber() : null)
                .ticketTitle(ticket != null ? ticket.getTitle() : null)
                .organizationId(resolveOrganizationId(ticket, cmd.getOrganizationId()))
                .notes(cmd.getNotes())
                .startedAt(cmd.getStartedAt())
                .endedAt(endedAt)
                .durationSeconds(cmd.getDurationSeconds())
                .source(TimeEntrySource.MANUAL)
                .createdBy(actingUserId)
                .lastModifiedBy(actingUserId)
                .build();
        return timeEntryRepository.save(entry);
    }

    @Transactional
    public TimeEntry updateTimeEntry(String actingUserId, UpdateTimeEntryCommand cmd) {
        log.info("Updating time entry {} by {}", cmd.getId(), actingUserId);
        TimeEntry entry = requireEntry(cmd.getId());
        if (entry.getEndedAt() == null) {
            throw new ConflictException(ErrorCode.TIME_ENTRY_RUNNING_NOT_EDITABLE,
                    "Cannot edit a running timer; stop it first");
        }

        String ticketId = cmd.getTicketId() == null
                ? entry.getTicketId()
                : (cmd.getTicketId().isBlank() ? null : cmd.getTicketId());
        String notes = cmd.getNotes() == null
                ? entry.getNotes()
                : (cmd.getNotes().isBlank() ? null : cmd.getNotes());
        requireTicketOrNotes(ticketId, notes);

        boolean ticketChanged = !Objects.equals(ticketId, entry.getTicketId());
        Ticket ticket = null;
        if (ticketChanged) {
            ticket = ticketId != null ? requireActiveTicket(ticketId) : null;
            populateTicketReference(entry, ticket);
        }

        applyOrganizationChange(entry, cmd.getOrganizationId(), ticket, ticketChanged);

        if (cmd.getUserId() != null && !cmd.getUserId().isBlank()) {
            entry.setUserId(cmd.getUserId());
        }

        boolean startedAtChanged = cmd.getStartedAt() != null;
        boolean durationChanged = cmd.getDurationSeconds() != null;
        if (durationChanged && cmd.getDurationSeconds() <= 0) {
            throw new ValidationException("Duration must be positive");
        }
        if (startedAtChanged) entry.setStartedAt(cmd.getStartedAt());
        if (durationChanged) entry.setDurationSeconds(cmd.getDurationSeconds());
        if (startedAtChanged || durationChanged) {
            entry.setEndedAt(entry.getStartedAt().plusSeconds(entry.getDurationSeconds()));
        }
        entry.setNotes(notes);
        entry.setLastModifiedBy(actingUserId);
        return timeEntryRepository.save(entry);
    }

    @Transactional
    public TimeEntry unlinkTicketFromTimeEntry(String actingUserId, String entryId) {
        log.info("Unlinking ticket from time entry {} by {}", entryId, actingUserId);
        TimeEntry entry = requireEntry(entryId);
        if (entry.getEndedAt() == null) {
            throw new ConflictException(ErrorCode.TIME_ENTRY_RUNNING_NOT_EDITABLE,
                    "Cannot edit a running timer; stop it first");
        }
        requireTicketOrNotes(null, entry.getNotes());
        if (entry.getTicketId() == null) {
            return entry;
        }
        entry.setTicketId(null);
        entry.setLastModifiedBy(actingUserId);
        return timeEntryRepository.save(entry);
    }

    @Transactional
    public boolean deleteTimeEntry(String actingUserId, String entryId) {
        log.info("Deleting time entry {} by {}", entryId, actingUserId);
        Optional<TimeEntry> entry = timeEntryRepository.findById(entryId);
        if (entry.isEmpty()) return false;
        timeEntryRepository.delete(entry.get());
        return true;
    }

    public CountedGenericQueryResult<TimeEntry> queryEntries(
            TimeEntryFilterInput input,
            String search,
            CursorPaginationCriteria pagination,
            SortInput sort) {

        CursorPaginationCriteria normalized = pagination.normalize();

        String sortField = validateSortField(sort != null ? sort.getField() : null);
        SortDirection direction = (sort != null && sort.getDirection() != null)
                ? sort.getDirection() : SortDirection.DESC;

        TimeEntryQueryFilter filter = buildQueryFilter(input, search);
        validatePeriod(filter.getStartedFrom(), filter.getStartedTo());

        Query query = timeEntryRepository.buildTimeEntryQuery(filter);
        long total = timeEntryRepository.countTimeEntries(query);

        int limit = normalized.getLimit();
        List<TimeEntry> raw = timeEntryRepository.findTimeEntriesWithCursor(
                query, normalized.getCursor(), limit + 1, sortField, direction.name());
        boolean hasNext = raw.size() > limit;
        List<TimeEntry> page = hasNext ? raw.subList(0, limit) : raw;

        return CountedGenericQueryResult.<TimeEntry>builder()
                .items(page)
                .pageInfo(buildPageInfo(page, hasNext, normalized.hasCursor()))
                .filteredCount((int) total)
                .build();
    }

    /**
     * Stats scoped by optional filter fields (employees, organizations, period).
     * Null filter = tenant-wide today + all-time period stats.
     */
    public EmployeeTimeStats getEmployeeTimeStats(TimeEntryFilterInput input) {
        TimeEntryFilterInput safe = input != null ? input : TimeEntryFilterInput.builder().build();
        List<String> userIds = safe.getEmployeeIds();
        List<String> organizationIds = safe.getOrganizationIds();
        Instant periodFrom = safe.getStartedFrom();
        Instant periodTo = safe.getStartedTo();
        validatePeriod(periodFrom, periodTo);

        Instant todayStart = LocalDate.now(ZoneOffset.UTC).atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant tomorrowStart = todayStart.plusSeconds(86_400L);

        long todayTotal = timeEntryRepository.sumDurationSeconds(userIds, organizationIds, todayStart, tomorrowStart);
        long todayCount = timeEntryRepository.countCompletedEntries(userIds, organizationIds, todayStart, tomorrowStart);

        long periodTotal = timeEntryRepository.sumDurationSeconds(userIds, organizationIds, periodFrom, periodTo);
        long periodCount = timeEntryRepository.countCompletedEntries(userIds, organizationIds, periodFrom, periodTo);
        long activeDays = timeEntryRepository.countDistinctActiveDays(userIds, organizationIds, periodFrom, periodTo);
        long avgPerDay = activeDays == 0L ? 0L : periodTotal / activeDays;

        return EmployeeTimeStats.builder()
                .todayTotalSeconds(todayTotal)
                .todayEntryCount(todayCount)
                .periodTotalSeconds(periodTotal)
                .periodEntryCount(periodCount)
                .averagePerDaySeconds(avgPerDay)
                .build();
    }

    public Map<String, Long> getTotalsByTickets(List<String> ticketIds) {
        return timeEntryRepository.sumDurationSecondsByTicketIds(ticketIds);
    }

    private TimeEntryQueryFilter buildQueryFilter(TimeEntryFilterInput input, String search) {
        TimeEntryFilterInput safe = input != null ? input : TimeEntryFilterInput.builder().build();
        return TimeEntryQueryFilter.builder()
                .userIds(safe.getEmployeeIds())
                .organizationIds(safe.getOrganizationIds())
                .startedFrom(safe.getStartedFrom())
                .startedTo(safe.getStartedTo())
                .search(search)
                .state(TimeEntryStateFilter.COMPLETED)
                .build();
    }

    private void populateTicketReference(TimeEntry entry, Ticket ticket) {
        if (ticket == null) {
            entry.setTicketId(null);
            entry.setTicketNumber(null);
            entry.setTicketTitle(null);
            return;
        }
        entry.setTicketId(ticket.getId());
        entry.setTicketNumber(ticket.getTicketNumber());
        entry.setTicketTitle(ticket.getTitle());
    }

    private String resolveOrganizationId(Ticket ticket, String manualOrganizationId) {
        if (ticket != null) {
            return ticket.getOrganizationId();
        }
        return manualOrganizationId == null || manualOrganizationId.isBlank()
                ? null
                : manualOrganizationId;
    }

    private void applyOrganizationChange(TimeEntry entry, String cmdOrganizationId, Ticket cachedTicket, boolean ticketChanged) {
        if (ticketChanged && cachedTicket != null) {
            entry.setOrganizationId(cachedTicket.getOrganizationId());
            return;
        }
        if (cmdOrganizationId == null) {
            return;
        }
        if (ticketChanged || entry.getTicketId() == null) {
            entry.setOrganizationId(cmdOrganizationId.isBlank() ? null : cmdOrganizationId);
        }
    }

    private TimeEntry requireActiveTimer(String userId) {
        return timeEntryRepository.findByUserIdAndEndedAtIsNull(userId)
                .orElseThrow(() -> new ConflictException(ErrorCode.TIME_ENTRY_NO_ACTIVE,
                        "No active timer for user"));
    }

    private TimeEntry requireEntry(String entryId) {
        return timeEntryRepository.findById(entryId)
                .orElseThrow(() -> new TimeEntryNotFoundException(
                        "TimeEntry " + entryId + " not found"));
    }

    private void requireTicketOrNotes(String ticketId, String notes) {
        boolean hasTicket = ticketId != null && !ticketId.isBlank();
        boolean hasNotes = notes != null && !notes.isBlank();
        if (!hasTicket && !hasNotes) {
            throw new ConflictException(ErrorCode.TIME_ENTRY_REQUIRES_CONTENT,
                    "Either ticket or notes must be provided");
        }
    }

    private Ticket requireActiveTicket(String ticketId) {
        Ticket ticket = ticketQueryService.findById(ticketId)
                .orElseThrow(() -> new NotFoundException(
                        ErrorCode.TICKET_NOT_FOUND, "Ticket not found: " + ticketId));
        if (isArchived(ticket)) {
            throw new ConflictException(ErrorCode.TIME_ENTRY_TICKET_ARCHIVED,
                    "Cannot log time on archived ticket. Reopen first.");
        }
        return ticket;
    }

    private boolean isArchived(Ticket ticket) {
        if (ticket.getStatusKind() == TicketStatusKind.ARCHIVED) return true;
        return ticket.getStatus() == TicketStatus.ARCHIVED;
    }

    private long secondsBetween(Instant from, Instant to) {
        return Math.max(0L, to.getEpochSecond() - from.getEpochSecond());
    }

    private void validatePeriod(Instant from, Instant to) {
        if (from == null || to == null) return;
        if (!to.isAfter(from)) {
            throw new ValidationException("End date must be after start date");
        }
    }

    private String validateSortField(String field) {
        if (field == null || field.trim().isEmpty()) {
            return timeEntryRepository.getDefaultSortField();
        }
        String trimmed = field.trim();
        if (!timeEntryRepository.isSortableField(trimmed)) {
            log.warn("Invalid sort field requested for time entries: {}, using default", field);
            return timeEntryRepository.getDefaultSortField();
        }
        return trimmed;
    }

    private PageInfo buildPageInfo(List<TimeEntry> items, boolean hasNext, boolean hasPrevious) {
        String startCursor = items.isEmpty() ? null : CursorCodec.encode(items.getFirst().getId());
        String endCursor = items.isEmpty() ? null : CursorCodec.encode(items.getLast().getId());
        return PageInfo.builder()
                .hasNextPage(hasNext)
                .hasPreviousPage(hasPrevious)
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
    }
}
