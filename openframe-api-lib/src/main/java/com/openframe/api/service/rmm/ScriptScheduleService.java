package com.openframe.api.service.rmm;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.rmm.schedule.CreateScriptScheduleInput;
import com.openframe.api.dto.rmm.schedule.ScriptScheduleFilterInput;
import com.openframe.api.dto.rmm.schedule.ScriptScheduleResponse;
import com.openframe.api.dto.rmm.schedule.UpdateScriptScheduleInput;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.ScriptScheduleMapper;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleTrigger;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.document.rmm.filter.ScriptScheduleQueryFilter;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Application-level operations on RMM script schedules. Mirrors
 * {@link ScriptService}: tenant scope is resolved internally via
 * {@link TenantIdProvider}, name uniqueness is enforced per tenant, and
 * {@link ScriptStatus#DELETED} is treated as "doesn't exist" for
 * {@link #get(String)} / {@link #update(UpdateScriptScheduleInput)} (soft-delete).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScriptScheduleService {

    /**
     * Schedules live on a half-hour grid: every run happens at xx:00 or xx:30 and every
     * repeat is a whole number of these slots. The management runner ticks on the same
     * grid, so an off-grid instant would simply never coincide with a tick.
     */
    private static final long SLOT_SECONDS = 1800L;

    private static final List<ScriptStatus> NAME_UNIQUE_STATUSES =
            List.of(ScriptStatus.ACTIVE, ScriptStatus.ARCHIVED);

    private final ScriptScheduleRepository scheduleRepository;
    private final ScriptScheduleMapper scheduleMapper;
    private final TenantIdProvider tenantIdProvider;

    /**
     * Create a new schedule in the current tenant.
     *
     * @throws ConflictException if a schedule with the same name already exists.
     */
    public ScriptScheduleResponse create(CreateScriptScheduleInput input, String createdBy) {
        String tenantId = tenantIdProvider.getTenantId();

        if (scheduleRepository.existsByTenantIdAndNameAndStatusIn(tenantId, input.getName(), NAME_UNIQUE_STATUSES)) {
            throw new ConflictException("Script schedule with name '" + input.getName() + "' already exists");
        }

        ScriptScheduleTrigger trigger = defaultTrigger(input.getTrigger());
        validateTiming(trigger, input.getStartAt(), input.getRepeat());

        ScriptSchedule entity = scheduleMapper.toEntity(tenantId, input);
        entity.setCreatedBy(createdBy);
        entity.setNextRunAt(trigger == ScriptScheduleTrigger.DATE_TIME ? entity.getStartAt() : null);
        ScriptSchedule saved = scheduleRepository.save(entity);
        log.info("Created script schedule id={} name='{}' tenantId={}", saved.getId(), saved.getName(), tenantId);
        return scheduleMapper.toResponse(saved);
    }

    /**
     * Get a single schedule by id within the current tenant.
     *
     * @throws NotFoundException if it does not exist, belongs to a different tenant, or is soft-deleted.
     */
    public ScriptScheduleResponse get(String id) {
        return scheduleMapper.toResponse(loadVisibleOrThrow(tenantIdProvider.getTenantId(), id));
    }

    /** Optional, non-throwing lookup — empty for a missing, soft-deleted, or other-tenant schedule. */
    public Optional<ScriptScheduleResponse> findById(String id) {
        return scheduleRepository.findByTenantIdAndId(tenantIdProvider.getTenantId(), id)
                .filter(schedule -> schedule.getStatus() != ScriptStatus.DELETED)
                .map(scheduleMapper::toResponse);
    }

    /** Batch lookup of schedules by id in the current tenant. Unknown ids are simply absent. */
    public List<ScriptScheduleResponse> getSchedulesByIds(Collection<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        return scheduleRepository.findByTenantIdAndIdIn(tenantIdProvider.getTenantId(), ids).stream()
                .map(scheduleMapper::toResponse)
                .toList();
    }

    /**
     * Cursor-paginated list of schedules in the current tenant, with
     * optional filter / search / sort. Default order is newest-first (by
     * {@code _id} desc). Uses the "fetch limit + 1" trick to detect further pages.
     */
    public CountedGenericQueryResult<ScriptScheduleResponse> list(ScriptScheduleFilterInput filter,
                                                                  String search,
                                                                  SortInput sort,
                                                                  CursorPaginationCriteria pagination) {
        String tenantId = tenantIdProvider.getTenantId();
        CursorPaginationCriteria normalized = pagination.normalize();
        int limit = normalized.getLimit();

        String sortField = resolveSortField(sort);
        Sort.Direction sortDirection = resolveSortDirection(sort);
        ScriptScheduleQueryFilter queryFilter = toQueryFilter(filter);

        long filteredCount = scheduleRepository.countForTenant(tenantId, queryFilter, search);

        List<ScriptSchedule> page = scheduleRepository.findPageForTenant(
                tenantId, queryFilter, search, sortField, sortDirection,
                normalized.getCursor(), normalized.isBackward(), limit + 1);

        boolean hasMore = page.size() > limit;
        List<ScriptSchedule> items = hasMore ? page.subList(0, limit) : page;

        if (normalized.isBackward()) {
            items = items.reversed();
        }

        List<ScriptScheduleResponse> views = items.stream().map(scheduleMapper::toResponse).toList();

        return CountedGenericQueryResult.<ScriptScheduleResponse>builder()
                .items(views)
                .pageInfo(buildPageInfo(items, hasMore, normalized, sortField))
                .filteredCount((int) filteredCount)
                .build();
    }

    private String resolveSortField(SortInput sort) {
        if (sort == null || sort.getField() == null || sort.getField().isBlank()) {
            return scheduleRepository.getDefaultSortField();
        }
        String requested = sort.getField().trim();
        if (!scheduleRepository.isSortableField(requested)) {
            log.warn("Invalid sort field requested for script schedules: '{}' — falling back to default", requested);
            return scheduleRepository.getDefaultSortField();
        }
        return requested;
    }

    private static Sort.Direction resolveSortDirection(SortInput sort) {
        if (sort != null && sort.getDirection() == SortDirection.ASC) {
            return Sort.Direction.ASC;
        }
        return Sort.Direction.DESC;
    }

    private static ScriptScheduleQueryFilter toQueryFilter(ScriptScheduleFilterInput input) {
        if (input == null) {
            return null;
        }
        return ScriptScheduleQueryFilter.builder()
                .statuses(input.getStatuses())
                .supportedPlatforms(input.getSupportedPlatforms())
                .createdByIds(input.getAuthorIds())
                .build();
    }

    /**
     * Full replacement of an existing schedule (PUT semantics).
     *
     * @throws NotFoundException if it does not exist or has been soft-deleted.
     * @throws ConflictException if the supplied name collides with another schedule.
     */
    public ScriptScheduleResponse update(UpdateScriptScheduleInput input) {
        String id = input.getId();
        String tenantId = tenantIdProvider.getTenantId();
        ScriptSchedule existing = loadVisibleOrThrow(tenantId, id);

        if (!input.getName().equals(existing.getName())
                && scheduleRepository.existsByTenantIdAndNameAndIdNotAndStatusIn(
                        tenantId, input.getName(), id, NAME_UNIQUE_STATUSES)) {
            throw new ConflictException("Script schedule with name '" + input.getName() + "' already exists");
        }

        ScriptScheduleTrigger trigger = defaultTrigger(input.getTrigger());
        validateTiming(trigger, input.getStartAt(), input.getRepeat());

        Instant priorStartAt = existing.getStartAt();
        scheduleMapper.updateEntity(existing, input);
        if (trigger == ScriptScheduleTrigger.DATE_TIME) {
            if (!Objects.equals(priorStartAt, existing.getStartAt())) {
                existing.setNextRunAt(existing.getStartAt());
            }
        } else {
            existing.setNextRunAt(null);   // event-driven: never on the timer grid
        }
        ScriptSchedule saved = scheduleRepository.save(existing);
        log.info("Updated script schedule id={} tenantId={}", saved.getId(), tenantId);
        return scheduleMapper.toResponse(saved);
    }

    /**
     * Soft-delete a schedule: transition status to {@link ScriptStatus#DELETED}.
     * Idempotent on already-deleted schedules.
     *
     * @return the id of the deleted schedule.
     * @throws NotFoundException if the id does not exist in the tenant.
     */
    public String delete(String id) {
        String tenantId = tenantIdProvider.getTenantId();
        ScriptSchedule existing = loadOrThrow(tenantId, id);

        if (existing.getStatus() == ScriptStatus.DELETED) {
            log.debug("Script schedule id={} tenantId={} already soft-deleted, no-op", id, tenantId);
            return existing.getId();
        }

        existing.setStatus(ScriptStatus.DELETED);
        existing.setStatusChangedAt(Instant.now());
        scheduleRepository.save(existing);
        log.info("Soft-deleted script schedule id={} tenantId={}", id, tenantId);
        return existing.getId();
    }

    /** Archive a schedule. Idempotent on already-archived schedules. */
    public ScriptScheduleResponse archive(String id) {
        return transitionTo(id, ScriptStatus.ARCHIVED);
    }

    /** Restore an archived schedule back to {@link ScriptStatus#ACTIVE}. Idempotent. */
    public ScriptScheduleResponse unarchive(String id) {
        return transitionTo(id, ScriptStatus.ACTIVE);
    }

    private ScriptScheduleResponse transitionTo(String id, ScriptStatus target) {
        String tenantId = tenantIdProvider.getTenantId();
        ScriptSchedule existing = loadVisibleOrThrow(tenantId, id);

        if (existing.getStatus() == target) {
            log.debug("Script schedule id={} tenantId={} already {}, no-op", id, tenantId, target);
            return scheduleMapper.toResponse(existing);
        }

        existing.setStatus(target);
        existing.setStatusChangedAt(Instant.now());
        ScriptSchedule saved = scheduleRepository.save(existing);
        log.info("Script schedule id={} tenantId={} status changed to {}", id, tenantId, target);
        return scheduleMapper.toResponse(saved);
    }

    private static ScriptScheduleTrigger defaultTrigger(ScriptScheduleTrigger trigger) {
        return trigger != null ? trigger : ScriptScheduleTrigger.DATE_TIME;
    }

    private static void validateTiming(ScriptScheduleTrigger trigger, Instant startAt, Long repeatSeconds) {
        if (trigger == ScriptScheduleTrigger.DEVICE_ONLINE) {
            if (startAt != null || repeatSeconds != null) {
                throw new BadRequestException(
                        "A DEVICE_ONLINE schedule is event-triggered and must not set startAt or repeat");
            }
            return;
        }
        validateGrid(startAt, repeatSeconds);
    }

    private static void validateGrid(Instant startAt, Long repeatSeconds) {
        if (startAt != null && !isOnSlot(startAt)) {
            throw new BadRequestException(
                    "startAt must fall on a 30-minute boundary (xx:00 or xx:30), got " + startAt);
        }
        if (repeatSeconds != null && (repeatSeconds <= 0 || repeatSeconds % SLOT_SECONDS != 0)) {
            throw new BadRequestException(
                    "repeat must be a positive whole number of 30-minute slots (multiple of " + SLOT_SECONDS
                            + " seconds), got " + repeatSeconds);
        }
    }

    private static boolean isOnSlot(Instant instant) {
        return instant.getNano() == 0 && Math.floorMod(instant.getEpochSecond(), SLOT_SECONDS) == 0;
    }

    private ScriptSchedule loadOrThrow(String tenantId, String id) {
        return scheduleRepository.findByTenantIdAndId(tenantId, id)
                .orElseThrow(() -> new NotFoundException("Script schedule not found: " + id));
    }

    private ScriptSchedule loadVisibleOrThrow(String tenantId, String id) {
        ScriptSchedule schedule = loadOrThrow(tenantId, id);
        if (schedule.getStatus() == ScriptStatus.DELETED) {
            throw new NotFoundException("Script schedule not found: " + id);
        }
        return schedule;
    }

    /**
     * Cursors are built from the ENTITIES (not the mapped views) and via the repository,
     * because the cursor must encode the active sort value alongside the id — the keyset
     * predicate on the other side has to match it exactly.
     */
    private PageInfo buildPageInfo(List<ScriptSchedule> items, boolean hasMore,
                                   CursorPaginationCriteria criteria, String sortField) {
        String startCursor = items.isEmpty() ? null
                : CursorCodec.encode(scheduleRepository.encodeCursor(items.getFirst(), sortField));
        String endCursor = items.isEmpty() ? null
                : CursorCodec.encode(scheduleRepository.encodeCursor(items.getLast(), sortField));

        boolean hasNextPage = criteria.isBackward() ? criteria.hasCursor() : hasMore;
        boolean hasPreviousPage = criteria.isBackward() ? hasMore : criteria.hasCursor();

        return PageInfo.builder()
                .hasNextPage(hasNextPage)
                .hasPreviousPage(hasPreviousPage)
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
    }
}
