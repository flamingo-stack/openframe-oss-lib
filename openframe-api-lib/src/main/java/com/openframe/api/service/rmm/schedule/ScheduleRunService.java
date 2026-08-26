package com.openframe.api.service.rmm.schedule;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.rmm.schedulerun.ScheduleRunFilterInput;
import com.openframe.api.dto.rmm.schedulerun.ScheduleRunResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import org.springframework.data.domain.Sort;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.data.document.rmm.schedule.ScheduleScriptExecution;
import com.openframe.data.document.rmm.filter.ScheduleRunQueryFilter;
import com.openframe.data.repository.rmm.ScheduleScriptExecutionRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Backs the "Schedule Runs" tab. One row per {@link ScheduleScriptExecution} header;
 * the {@code respondedMachineCount} numerator (X in "X / Y devices") is computed at
 * read time via one batch aggregation over the leaf collection, so page-render is
 * two Mongo round-trips regardless of page size (list + count query, then one
 * responded-devices aggregation for all rows).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ScheduleRunService {

    private final ScheduleScriptExecutionRepository scheduleScriptExecutionRepository;
    private final TenantIdProvider tenantIdProvider;

    public CountedGenericQueryResult<ScheduleRunResponse> list(String scheduleId,
                                                               ScheduleRunFilterInput filter,
                                                               String search,
                                                               SortInput sort,
                                                               CursorPaginationCriteria pagination) {
        String tenantId = tenantIdProvider.getTenantId();
        CursorPaginationCriteria normalized = pagination.normalize();
        int limit = normalized.getLimit();
        ScheduleRunQueryFilter queryFilter = toQueryFilter(filter);
        String sortField = resolveSortField(sort);
        Sort.Direction sortDirection = resolveSortDirection(sort);

        long filteredCount = scheduleScriptExecutionRepository.countForSchedule(tenantId, scheduleId, queryFilter, search);

        List<ScheduleScriptExecution> page = scheduleScriptExecutionRepository.findPageForSchedule(
                tenantId, scheduleId, queryFilter, search, sortField, sortDirection,
                normalized.getCursor(), normalized.isBackward(), limit + 1);

        boolean hasMore = page.size() > limit;
        List<ScheduleScriptExecution> items = hasMore ? page.subList(0, limit) : page;
        if (normalized.isBackward()) {
            items = items.reversed();
        }

        // One batch aggregation for the whole page — no N+1.
        Map<String, Long> respondedByExecutionId = scheduleScriptExecutionRepository.countRespondedDevicesByExecutionIds(tenantId,
                        items.stream().map(ScheduleScriptExecution::getExecutionId).toList());

        List<ScheduleRunResponse> views = items.stream()
                .map(h -> toResponse(h, respondedByExecutionId.getOrDefault(h.getExecutionId(), 0L).intValue()))
                .toList();

        return CountedGenericQueryResult.<ScheduleRunResponse>builder()
                .items(views)
                .pageInfo(buildPageInfo(items, hasMore, normalized, sortField))
                .filteredCount((int) filteredCount)
                .build();
    }

    private String resolveSortField(SortInput sort) {
        if (sort == null || sort.getField() == null || sort.getField().isBlank()) {
            return scheduleScriptExecutionRepository.getDefaultSortField();
        }
        String requested = sort.getField().trim();
        if (!scheduleScriptExecutionRepository.isSortableField(requested)) {
            log.warn("Invalid sort field requested for schedule runs: '{}' — falling back to default", requested);
            return scheduleScriptExecutionRepository.getDefaultSortField();
        }
        return requested;
    }

    private static Sort.Direction resolveSortDirection(SortInput sort) {
        if (sort != null && sort.getDirection() == SortDirection.ASC) {
            return Sort.Direction.ASC;
        }
        return Sort.Direction.DESC;
    }

    public Optional<ScheduleRunResponse> findById(String id) {
        String tenantId = tenantIdProvider.getTenantId();
        return scheduleScriptExecutionRepository.findByTenantIdAndId(tenantId, id)
                .map(h -> {
                    Map<String, Long> respondedByExecutionId = scheduleScriptExecutionRepository
                            .countRespondedDevicesByExecutionIds(tenantId, List.of(h.getExecutionId()));
                    return toResponse(h, respondedByExecutionId.getOrDefault(h.getExecutionId(), 0L).intValue());
                });
    }

    private static ScheduleRunQueryFilter toQueryFilter(ScheduleRunFilterInput input) {
        if (input == null) {
            return null;
        }
        return ScheduleRunQueryFilter.builder()
                .statuses(input.getStatuses())
                .dispatchedAtFrom(input.getDispatchedAtFrom())
                .dispatchedAtTo(input.getDispatchedAtTo())
                .build();
    }

    private static ScheduleRunResponse toResponse(ScheduleScriptExecution h, int respondedMachineCount) {
        return ScheduleRunResponse.builder()
                .id(h.getId())
                .executionId(h.getExecutionId())
                .scheduleId(h.getScheduleId())
                .initiatedBy(h.getInitiatedBy())
                .status(h.getStatus())
                .totalMachineCount(h.getTotalMachineCount())
                .respondedMachineCount(respondedMachineCount)
                .dispatchedAt(h.getDispatchedAt())
                .finishedAt(h.getFinishedAt())
                .build();
    }

    private PageInfo buildPageInfo(List<ScheduleScriptExecution> items, boolean hasMore,
                                   CursorPaginationCriteria pagination, String sortField) {
        boolean hasPrev;
        boolean hasNext;
        if (pagination.isBackward()) {
            hasPrev = hasMore;
            hasNext = pagination.getCursor() != null;
        } else {
            hasPrev = pagination.getCursor() != null;
            hasNext = hasMore;
        }
        String startCursor = items.isEmpty() ? null
                : CursorCodec.encode(scheduleScriptExecutionRepository.encodeCursor(items.get(0), sortField));
        String endCursor = items.isEmpty() ? null
                : CursorCodec.encode(scheduleScriptExecutionRepository.encodeCursor(items.get(items.size() - 1), sortField));
        return PageInfo.builder()
                .hasNextPage(hasNext)
                .hasPreviousPage(hasPrev)
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
    }
}
