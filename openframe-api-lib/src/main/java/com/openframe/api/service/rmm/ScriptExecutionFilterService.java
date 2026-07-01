package com.openframe.api.service.rmm;

import com.openframe.api.dto.rmm.execution.ScriptExecutionFilterInput;
import com.openframe.api.dto.rmm.execution.ScriptExecutionFilters;
import com.openframe.data.document.rmm.filter.ScriptExecutionQueryFilter;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Faceted "Executed by" options for the Execution History tab — the executions
 * counterpart of {@code ScriptFilterService}. Distinct initiators for one script with
 * live counts (the other active filters applied, but not the initiator field). Option
 * building (incl. initiator-id → display-name resolution) is delegated to
 * {@link ScriptFilterOptionMapper}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ScriptExecutionFilterService {

    private final ScriptExecutionRepository scriptExecutionRepository;
    private final ScriptFilterOptionMapper optionMapper;
    private final TenantIdProvider tenantIdProvider;

    public ScriptExecutionFilters getExecutionFilters(String scriptId, ScriptExecutionFilterInput input, String search) {
        String tenantId = tenantIdProvider.getTenantId();
        ScriptExecutionQueryFilter filter = toQueryFilter(input);

        Map<String, Integer> initiators = scriptExecutionRepository.initiatorFacet(tenantId, scriptId, filter, search);
        Map<String, Integer> statuses = scriptExecutionRepository.statusFacet(tenantId, scriptId, filter, search);
        Map<String, Integer> machines = scriptExecutionRepository.machineFacet(tenantId, scriptId, filter, search);
        long filteredCount = scriptExecutionRepository.countForScript(tenantId, scriptId, filter, search);

        return ScriptExecutionFilters.builder()
                .initiators(optionMapper.userLabeled(initiators))
                .statuses(optionMapper.selfLabeled(statuses))
                .machines(optionMapper.machineLabeled(machines))
                .filteredCount((int) filteredCount)
                .build();
    }

    private static ScriptExecutionQueryFilter toQueryFilter(ScriptExecutionFilterInput input) {
        if (input == null) {
            return null;
        }
        return ScriptExecutionQueryFilter.builder()
                .statuses(input.getStatuses())
                .initiatedByIds(input.getInitiatorIds())
                .machineIds(input.getMachineIds())
                .build();
    }
}
