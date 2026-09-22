package com.openframe.api.service.rmm.schedule;

import com.openframe.api.dto.rmm.schedulerun.ScheduleRunFilterInput;
import com.openframe.api.dto.rmm.schedulerun.ScheduleRunFilters;
import com.openframe.api.mapper.ScriptFilterOptionMapper;
import com.openframe.api.service.rmm.script.ScriptExecutionFilterService;
import com.openframe.data.document.rmm.filter.ScheduleRunQueryFilter;
import com.openframe.data.repository.rmm.ScheduleScriptExecutionRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Faceted "Status" / "Executed by" options for the "Schedule Runs" tab — the filter panel paired
 * with the {@code scheduleRuns} connection. Mirrors {@link ScriptExecutionFilterService}: each facet
 * is computed over the same {@code (schedule, filter, search)} scope, and option building
 * (incl. initiator-id → display-name) is delegated to {@link ScriptFilterOptionMapper}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ScheduleRunFilterService {

    private static final String FIELD_STATUS = "status";
    private static final String FIELD_INITIATED_BY = "initiatedBy";

    private final ScheduleScriptExecutionRepository scheduleScriptExecutionRepository;
    private final ScriptFilterOptionMapper optionMapper;
    private final TenantIdProvider tenantIdProvider;

    public ScheduleRunFilters getScheduleRunFilters(String scheduleId,
                                                    ScheduleRunFilterInput input,
                                                    String search) {
        String tenantId = tenantIdProvider.getTenantId();
        ScheduleRunQueryFilter filter = toQueryFilter(input);

        Map<String, Integer> statuses = scheduleScriptExecutionRepository
                .facet(tenantId, scheduleId, filter, search, FIELD_STATUS);
        Map<String, Integer> initiators = scheduleScriptExecutionRepository
                .facet(tenantId, scheduleId, filter, search, FIELD_INITIATED_BY);
        long filteredCount = scheduleScriptExecutionRepository
                .countForSchedule(tenantId, scheduleId, filter, search);

        return ScheduleRunFilters.builder()
                .statuses(optionMapper.selfLabeled(statuses))
                .initiators(optionMapper.userLabeled(initiators))
                .filteredCount((int) filteredCount)
                .build();
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
}
