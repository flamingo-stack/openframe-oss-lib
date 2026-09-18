package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareActionFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareActionFilters;
import com.openframe.api.dto.rmm.software.SoftwareActionResponse;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.mapper.ScriptFilterOptionMapper;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.data.document.rmm.filter.SoftwareActionQueryFilter;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareSchedulePackage;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.document.rmm.software.SoftwareActionSummary;
import com.openframe.data.document.rmm.software.SoftwareExecutionId;
import com.openframe.data.repository.rmm.SoftwareActionAggregationRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class SoftwareActionService {

    private static final int DEFAULT_PER_PAGE = 25;

    private static final Map<String, String> SORT_FIELD = Map.of(
            "status", "status",
            "software", "packageName",
            "processedDevices", "totalMachineCount",
            "devices", "totalMachineCount",
            "dispatchedAt", "dispatchedAt");

    private static final String FIELD_STATUS = "status";
    private static final String FIELD_ACTION = "action";
    private static final String FIELD_ENGINE = "packageManager";

    private final SoftwareActionAggregationRepository aggregationRepository;
    private final SoftwareScheduleRepository scheduleRepository;
    private final SoftwareScheduleMachineAssignedRepository assignedRepository;
    private final ScriptFilterOptionMapper optionMapper;
    private final TenantIdProvider tenantIdProvider;

    public PageResult<SoftwareActionResponse> list(SoftwareActionFilterInput filter, String search,
                                                   SortInput sort, int page, Integer perPage) {
        String tenantId = tenantIdProvider.getTenantId();
        int size = perPage != null && perPage > 0 ? perPage : DEFAULT_PER_PAGE;
        SoftwareActionQueryFilter queryFilter = toQueryFilter(filter);
        String sortField = resolveSortField(sort);
        Sort.Direction direction = resolveDirection(sort);

        List<SoftwareActionResponse> scheduled = includeScheduled(filter)
                ? scheduledRows(tenantId, filter, search)
                : List.of();
        long executedTotal = aggregationRepository.count(tenantId, queryFilter, search);
        long total = scheduled.size() + executedTotal;

        int offset = Math.max(0, page) * size;
        List<SoftwareActionResponse> items = new ArrayList<>(size);
        if (offset < scheduled.size()) {
            int to = Math.min(scheduled.size(), offset + size);
            items.addAll(scheduled.subList(offset, to));
            int remaining = size - items.size();
            if (remaining > 0) {
                items.addAll(mapExecuted(aggregationRepository.findPage(tenantId, queryFilter, search, sortField, direction, 0, remaining)));
            }
        } else {
            int executedSkip = offset - scheduled.size();
            items.addAll(mapExecuted(aggregationRepository.findPage(tenantId, queryFilter, search, sortField, direction, executedSkip, size)));
        }

        boolean hasNext = (long) offset + items.size() < total;
        boolean hasPrev = page > 0;
        return new PageResult<>(items, hasNext, hasPrev, (int) total, page);
    }

    public SoftwareActionFilters filters(SoftwareActionFilterInput filter, String search) {
        String tenantId = tenantIdProvider.getTenantId();
        SoftwareActionQueryFilter queryFilter = toQueryFilter(filter);

        Map<String, Integer> statuses = new LinkedHashMap<>(aggregationRepository.facet(tenantId, queryFilter, search, FIELD_STATUS));
        Map<String, Integer> actions = new LinkedHashMap<>(aggregationRepository.facet(tenantId, queryFilter, search, FIELD_ACTION));
        Map<String, Integer> engines = new LinkedHashMap<>(aggregationRepository.facet(tenantId, queryFilter, search, FIELD_ENGINE));

        List<SoftwareActionResponse> scheduled = includeScheduled(filter)
                ? scheduledRows(tenantId, filter, search)
                : List.of();
        for (SoftwareActionResponse row : scheduled) {
            bump(statuses, row.getStatus() != null ? row.getStatus().name() : null);
            bump(actions, row.getAction() != null ? row.getAction().name() : null);
            bump(engines, row.getEngine() != null ? row.getEngine().name() : null);
        }

        long filteredCount = scheduled.size() + aggregationRepository.count(tenantId, queryFilter, search);

        return SoftwareActionFilters.builder()
                .statuses(optionMapper.selfLabeled(statuses))
                .actions(optionMapper.selfLabeled(actions))
                .engines(optionMapper.selfLabeled(engines))
                .filteredCount((int) filteredCount)
                .build();
    }

    private static void bump(Map<String, Integer> counts, String key) {
        if (key != null) {
            counts.merge(key, 1, Integer::sum);
        }
    }

    public Optional<SoftwareActionResponse> findById(String executionId) {
        return aggregationRepository.findByExecutionId(tenantIdProvider.getTenantId(), executionId)
                .map(SoftwareActionService::toResponse);
    }

    private List<SoftwareActionResponse> scheduledRows(String tenantId, SoftwareActionFilterInput filter, String search) {
        List<SoftwareSchedule> upcoming = scheduleRepository
                .findByTenantIdAndStatusAndNextRunAtGreaterThanOrderByNextRunAtAsc(tenantId, ScriptStatus.ACTIVE, Instant.now());
        List<SoftwareActionResponse> rows = new ArrayList<>();
        for (SoftwareSchedule schedule : upcoming) {
            if (schedule.getPackages() == null) {
                continue;
            }
            int deviceCount = (int) assignedRepository.countByTenantIdAndSoftwareScheduleId(tenantId, schedule.getId());
            for (SoftwareSchedulePackage pkg : schedule.getPackages()) {
                if (!scheduledMatchesFilter(filter, search, schedule, pkg)) {
                    continue;
                }
                rows.add(SoftwareActionResponse.builder()
                        .id(SoftwareExecutionId.forSchedule(schedule.getId(), pkg.getPackageManager(), pkg.getPackageName()))
                        .executionId(SoftwareExecutionId.forSchedule(schedule.getId(), pkg.getPackageManager(), pkg.getPackageName()))
                        .software(pkg.getPackageName())
                        .action(schedule.getAction())
                        .engine(pkg.getPackageManager())
                        .status(SoftwareActionStatus.SCHEDULED)
                        .totalMachineCount(deviceCount)
                        .respondedMachineCount(0)
                        .scheduledAt(schedule.getNextRunAt())
                        .initiatedBy(schedule.getCreatedBy())
                        .scheduleId(schedule.getId())
                        .build());
            }
        }
        return rows;
    }

    private static boolean scheduledMatchesFilter(SoftwareActionFilterInput filter, String search,
                                                  SoftwareSchedule schedule, SoftwareSchedulePackage pkg) {
        if (filter != null) {
            if (filter.getActions() != null && !filter.getActions().isEmpty()
                    && !filter.getActions().contains(schedule.getAction())) {
                return false;
            }
            if (filter.getEngines() != null && !filter.getEngines().isEmpty()
                    && !filter.getEngines().contains(pkg.getPackageManager())) {
                return false;
            }
        }
        if (search != null && !search.isBlank()) {
            String needle = search.trim().toLowerCase(Locale.ROOT);
            return pkg.getPackageName() != null && pkg.getPackageName().toLowerCase(Locale.ROOT).contains(needle);
        }
        return true;
    }

    private static boolean includeScheduled(SoftwareActionFilterInput filter) {
        return filter == null || filter.getStatuses() == null || filter.getStatuses().isEmpty()
                || filter.getStatuses().contains(SoftwareActionStatus.SCHEDULED);
    }

    private String resolveSortField(SortInput sort) {
        if (sort == null || sort.getField() == null) {
            return aggregationRepository.getDefaultSortField();
        }
        String mapped = SORT_FIELD.get(sort.getField());
        return mapped != null && aggregationRepository.isSortableField(mapped)
                ? mapped : aggregationRepository.getDefaultSortField();
    }

    private static Sort.Direction resolveDirection(SortInput sort) {
        return sort != null && sort.getDirection() == SortDirection.ASC ? Sort.Direction.ASC : Sort.Direction.DESC;
    }

    private static SoftwareActionQueryFilter toQueryFilter(SoftwareActionFilterInput input) {
        if (input == null) {
            return null;
        }
        return SoftwareActionQueryFilter.builder()
                .statuses(input.getStatuses())
                .actions(input.getActions())
                .engines(input.getEngines())
                .build();
    }

    private static List<SoftwareActionResponse> mapExecuted(List<SoftwareActionSummary> summaries) {
        return summaries.stream().map(SoftwareActionService::toResponse).toList();
    }

    private static SoftwareActionResponse toResponse(SoftwareActionSummary s) {
        return SoftwareActionResponse.builder()
                .id(s.getExecutionId())
                .executionId(s.getExecutionId())
                .software(s.getPackageName())
                .action(s.getAction())
                .engine(s.getPackageManager())
                .status(s.getStatus())
                .totalMachineCount(s.getTotalMachineCount())
                .respondedMachineCount(s.getRespondedMachineCount())
                .dispatchedAt(s.getDispatchedAt())
                .initiatedBy(s.getInitiatedBy())
                .bundleId(s.getBundleId())
                .scheduleId(s.getScheduleId())
                .build();
    }
}
