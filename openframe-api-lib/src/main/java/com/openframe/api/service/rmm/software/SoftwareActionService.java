package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareActionFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareActionFilters;
import com.openframe.api.dto.rmm.software.SoftwareActionId;
import com.openframe.api.dto.rmm.software.SoftwareActionResponse;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.mapper.ScriptFilterOptionMapper;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.rmm.filter.SoftwareActionQueryFilter;
import com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger;
import com.openframe.data.document.rmm.schedule.ScheduleTimeReference;
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
import com.openframe.data.service.rmm.SoftwareScheduleTargetResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
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

    // UTC-12 is the last zone a wall-clock time comes in
    private static final Duration LATEST_ZONE_LAG = Duration.ofHours(12);

    private static final String DEFAULT_SORT_FIELD = "dispatchedAt";
    private static final String SORTABLE_FIELDS = "status, software, processedDevices, devices, dispatchedAt";
    private static final Map<String, String> SORT_FIELD = Map.of(
            "status", "status",
            "software", "packageName",
            "processedDevices", "respondedMachineCount",
            "devices", "totalMachineCount",
            DEFAULT_SORT_FIELD, DEFAULT_SORT_FIELD);

    private static final Comparator<String> NULLS_FIRST_TEXT = Comparator.nullsFirst(String::compareTo);
    private static final Comparator<Instant> NULLS_FIRST_TIME = Comparator.nullsFirst(Instant::compareTo);

    private static final String FIELD_STATUS = "status";
    private static final String FIELD_ACTION = "action";
    private static final String FIELD_KIND = "kind";
    private static final String FIELD_ENGINE = "packageManager";

    private final SoftwareActionAggregationRepository aggregationRepository;
    private final SoftwareScheduleRepository scheduleRepository;
    private final SoftwareScheduleMachineAssignedRepository assignedRepository;
    private final ScriptFilterOptionMapper optionMapper;
    private final TenantIdProvider tenantIdProvider;
    private final SoftwareScheduleTargetResolver softwareScheduleTargetResolver;

    public PageResult<SoftwareActionResponse> list(SoftwareActionFilterInput filter, String search,
                                                   SortInput sort, int page, Integer perPage) {
        String sortField = resolveSortField(sort);
        Sort.Direction direction = resolveDirection(sort);
        Comparator<SoftwareActionResponse> order = rowOrder(sortField, direction);
        String tenantId = tenantIdProvider.getTenantId();
        int size = perPage != null && perPage > 0 ? perPage : DEFAULT_PER_PAGE;
        SoftwareActionQueryFilter queryFilter = toQueryFilter(filter);

        List<SoftwareActionResponse> scheduled = includeScheduled(filter)
                ? scheduledRows(tenantId, filter, search)
                : new ArrayList<>();
        int scheduledCount = scheduled.size();
        long executedTotal = aggregationRepository.count(tenantId, queryFilter, search);
        long total = scheduledCount + executedTotal;

        int offset = Math.max(0, page) * size;
        int executedSkip = Math.max(0, offset - scheduledCount);
        int executedLimit = offset + size - executedSkip;
        List<SoftwareActionSummary> executedPage = aggregationRepository.findPage(tenantId, queryFilter, search,
                sortField, direction, executedSkip, executedLimit);
        List<SoftwareActionResponse> executed = mapExecuted(executedPage);

        List<SoftwareActionResponse> merged = merge(scheduled, executed, order);
        int mergedCount = merged.size();
        int from = Math.min(mergedCount, offset - executedSkip);
        int to = Math.min(mergedCount, from + size);
        List<SoftwareActionResponse> items = merged.subList(from, to).stream().toList();

        boolean hasNext = (long) offset + items.size() < total;
        boolean hasPrev = page > 0;
        return new PageResult<>(items, hasNext, hasPrev, (int) total, page);
    }

    private static List<SoftwareActionResponse> merge(List<SoftwareActionResponse> scheduled,
                                                      List<SoftwareActionResponse> executed,
                                                      Comparator<SoftwareActionResponse> order) {
        List<SoftwareActionResponse> merged = new ArrayList<>(scheduled);
        merged.addAll(executed);
        merged.sort(order);
        return merged;
    }

    private static Comparator<SoftwareActionResponse> rowOrder(String sortField, Sort.Direction direction) {
        Comparator<SoftwareActionResponse> primary = switch (sortField) {
            case "status" -> Comparator.comparingInt(SoftwareActionService::statusRank);
            case "packageName" -> Comparator.comparing(SoftwareActionResponse::getSoftware, NULLS_FIRST_TEXT);
            case "respondedMachineCount" -> Comparator.comparingInt(SoftwareActionResponse::getRespondedMachineCount)
                    .thenComparingInt(SoftwareActionResponse::getTotalMachineCount);
            case "totalMachineCount" -> Comparator.comparingInt(SoftwareActionResponse::getTotalMachineCount);
            default -> Comparator.comparing(SoftwareActionService::actionTime, NULLS_FIRST_TIME);
        };
        Comparator<SoftwareActionResponse> withTime = primary.thenComparing(SoftwareActionService::actionTime,
                NULLS_FIRST_TIME);
        Comparator<SoftwareActionResponse> directed = direction == Sort.Direction.ASC ? withTime : withTime.reversed();
        return directed.thenComparing(SoftwareActionResponse::getExecutionId, NULLS_FIRST_TEXT);
    }

    private static int statusRank(SoftwareActionResponse row) {
        SoftwareActionStatus status = row.getStatus();
        return status == null ? -1 : status.sortRank();
    }

    private static Instant actionTime(SoftwareActionResponse row) {
        Instant dispatchedAt = row.getDispatchedAt();
        return dispatchedAt != null ? dispatchedAt : row.getScheduledAt();
    }

    public SoftwareActionFilters filters(SoftwareActionFilterInput filter, String search) {
        String tenantId = tenantIdProvider.getTenantId();
        SoftwareActionQueryFilter queryFilter = toQueryFilter(filter);

        Map<String, Integer> statuses = new LinkedHashMap<>(aggregationRepository.facet(tenantId, queryFilter, search, FIELD_STATUS));
        Map<String, Integer> actions = new LinkedHashMap<>(aggregationRepository.facet(tenantId, queryFilter, search, FIELD_ACTION));
        Map<String, Integer> kinds = new LinkedHashMap<>(aggregationRepository.facet(tenantId, queryFilter, search, FIELD_KIND));
        Map<String, Integer> engines = new LinkedHashMap<>(aggregationRepository.facet(tenantId, queryFilter, search, FIELD_ENGINE));

        List<SoftwareActionResponse> scheduled = includeScheduled(filter)
                ? scheduledRows(tenantId, filter, search)
                : List.of();
        for (SoftwareActionResponse row : scheduled) {
            bump(statuses, row.getStatus() != null ? row.getStatus().name() : null);
            bump(actions, row.getAction() != null ? row.getAction().name() : null);
            bump(kinds, row.getKind() != null ? row.getKind().name() : null);
            bump(engines, row.getEngine() != null ? row.getEngine().name() : null);
        }

        long filteredCount = scheduled.size() + aggregationRepository.count(tenantId, queryFilter, search);

        return SoftwareActionFilters.builder()
                .statuses(optionMapper.selfLabeled(statuses))
                .actions(optionMapper.selfLabeled(actions))
                .kinds(optionMapper.selfLabeled(kinds))
                .engines(optionMapper.selfLabeled(engines))
                .filteredCount((int) filteredCount)
                .build();
    }

    private static void bump(Map<String, Integer> counts, String key) {
        if (key != null) {
            counts.merge(key, 1, Integer::sum);
        }
    }

    public Optional<SoftwareActionResponse> findById(String actionId) {
        String executionId = SoftwareActionId.decode(actionId).executionId();
        if (executionId == null) {
            return Optional.empty();
        }
        return aggregationRepository.findByExecutionId(tenantIdProvider.getTenantId(), executionId)
                .map(SoftwareActionService::toResponse);
    }

    private List<SoftwareActionResponse> scheduledRows(String tenantId, SoftwareActionFilterInput filter, String search) {
        Instant now = Instant.now();
        List<SoftwareSchedule> upcoming = new ArrayList<>(scheduleRepository
                .findByTenantIdAndStatusAndNextRunAtGreaterThanOrderByNextRunAtAsc(tenantId, ScriptStatus.ACTIVE, now));
        List<SoftwareSchedule> atDeviceTime = scheduleRepository
                .findByTenantIdAndStatusAndTriggerAndTimeReference(tenantId, ScriptStatus.ACTIVE,
                        ScheduleScriptTrigger.DATE_TIME, ScheduleTimeReference.DEVICE_LOCAL)
                .stream()
                .filter(schedule -> isAheadAtDeviceTime(schedule, now))
                .toList();
        Map<String, List<String>> awaitingMachineIds =
                softwareScheduleTargetResolver.resolveMachineIdsAwaitingDeviceTime(atDeviceTime);
        atDeviceTime.stream()
                .filter(schedule -> !awaitingMachineIds.get(schedule.getId()).isEmpty())
                .forEach(upcoming::add);
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
                String executionId = SoftwareExecutionId.forSchedule(schedule.getId(), pkg.getPackageManager(), pkg.getPackageName());
                rows.add(SoftwareActionResponse.builder()
                        .id(SoftwareActionId.of(executionId, null, schedule.getId()).encode())
                        .executionId(executionId)
                        .software(pkg.getPackageName())
                        .action(schedule.getAction())
                        .kind(schedule.getAction().kind())
                        .engine(pkg.getPackageManager())
                        .status(SoftwareActionStatus.SCHEDULED)
                        .totalMachineCount(deviceCount)
                        .respondedMachineCount(0)
                        .scheduledAt(nextRun(schedule, now))
                        .timeReference(schedule.getTimeReference())
                        .initiatedBy(schedule.getCreatedBy())
                        .scheduleId(schedule.getId())
                        .build());
            }
        }
        return rows;
    }

    // a device-time schedule keeps no nextRunAt: its one-off run is ahead until the time passed in the last time zone
    private static boolean isAheadAtDeviceTime(SoftwareSchedule schedule, Instant now) {
        Instant startAt = schedule.getStartAt();
        if (startAt == null) {
            return false;
        }
        Instant lastZoneRun = startAt.plus(LATEST_ZONE_LAG);
        return schedule.getRepeat() != null || now.isBefore(lastZoneRun);
    }

    // device time: the wall clock of the next run, written without a zone like the schedule's startAt
    private static Instant nextRun(SoftwareSchedule schedule, Instant now) {
        Instant nextRunAt = schedule.getNextRunAt();
        if (nextRunAt != null) {
            return nextRunAt;
        }
        Instant startAt = schedule.getStartAt();
        Long repeat = schedule.getRepeat();
        if (repeat == null || !startAt.isBefore(now)) {
            return startAt;
        }
        long runsPassed = Duration.between(startAt, now).getSeconds() / repeat;
        return startAt.plusSeconds((runsPassed + 1) * repeat);
    }

    private static boolean scheduledMatchesFilter(SoftwareActionFilterInput filter, String search,
                                                  SoftwareSchedule schedule, SoftwareSchedulePackage pkg) {
        if (filter != null) {
            if (filter.getActions() != null && !filter.getActions().isEmpty()
                    && !filter.getActions().contains(schedule.getAction())) {
                return false;
            }
            if (filter.getKinds() != null && !filter.getKinds().isEmpty()
                    && !filter.getKinds().contains(schedule.getAction().kind())) {
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

    private static String resolveSortField(SortInput sort) {
        String field = sort == null ? null : sort.getField();
        if (field == null) {
            return DEFAULT_SORT_FIELD;
        }
        String mapped = SORT_FIELD.get(field);
        if (mapped == null) {
            throw new BadRequestException("Unknown sort field '" + field + "'. Sortable fields: " + SORTABLE_FIELDS);
        }
        return mapped;
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
                .kinds(input.getKinds())
                .engines(input.getEngines())
                .build();
    }

    private static List<SoftwareActionResponse> mapExecuted(List<SoftwareActionSummary> summaries) {
        return summaries.stream().map(SoftwareActionService::toResponse).toList();
    }

    private static SoftwareActionResponse toResponse(SoftwareActionSummary s) {
        return SoftwareActionResponse.builder()
                .id(SoftwareActionId.of(s.getExecutionId(), s.getBundleId(), s.getScheduleId()).encode())
                .executionId(s.getExecutionId())
                .software(s.getPackageName())
                .version(s.getVersion())
                .action(s.getAction())
                .kind(s.getKind())
                .engine(s.getPackageManager())
                .status(s.getStatus())
                .totalMachineCount(s.getTotalMachineCount())
                .respondedMachineCount(s.getRespondedMachineCount())
                .waitingMachineCount(s.getWaitingMachineCount())
                .dispatchedAt(s.getDispatchedAt())
                .finishedAt(s.getFinishedAt())
                .initiatedBy(s.getInitiatedBy())
                .bundleId(s.getBundleId())
                .scheduleId(s.getScheduleId())
                .build();
    }
}
