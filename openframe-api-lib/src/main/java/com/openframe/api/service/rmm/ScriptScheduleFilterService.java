package com.openframe.api.service.rmm;

import com.openframe.api.dto.rmm.schedule.ScriptScheduleFilterInput;
import com.openframe.api.dto.rmm.schedule.ScriptScheduleFilters;
import com.openframe.data.document.rmm.filter.ScriptScheduleQueryFilter;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Faceted filter options for the script-schedules list "OS / Added by" dropdowns.
 * Mirrors {@link ScriptFilterService} (minus the shell facet); option building
 * (incl. author-id → display-name) is delegated to the shared
 * {@link ScriptFilterOptionMapper}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ScriptScheduleFilterService {

    private final ScriptScheduleRepository scheduleRepository;
    private final ScriptFilterOptionMapper optionMapper;
    private final TenantIdProvider tenantIdProvider;

    public ScriptScheduleFilters getScriptScheduleFilters(ScriptScheduleFilterInput input) {
        String tenantId = tenantIdProvider.getTenantId();
        ScriptScheduleQueryFilter filter = toQueryFilter(input);

        Map<String, Integer> platforms = scheduleRepository.platformFacet(tenantId, filter);
        Map<String, Integer> authors = scheduleRepository.authorFacet(tenantId, filter);
        long filteredCount = scheduleRepository.countForTenant(tenantId, filter, null);

        return ScriptScheduleFilters.builder()
                .platforms(optionMapper.selfLabeled(platforms))
                .authors(optionMapper.userLabeled(authors))
                .filteredCount((int) filteredCount)
                .build();
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
}
