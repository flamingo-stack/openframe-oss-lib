package com.openframe.api.service.rmm.script;

import com.openframe.api.dto.rmm.execution.ScriptExecutionFilterInput;
import com.openframe.api.dto.rmm.execution.ScriptExecutionFilters;
import com.openframe.api.mapper.ScriptFilterOptionMapper;
import com.openframe.data.document.rmm.filter.ExecutionFacetField;
import com.openframe.data.document.rmm.filter.ExecutionOwnerScope;
import com.openframe.data.document.rmm.filter.ScriptExecutionQueryFilter;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Faceted "Executed by" / "Status" / "Device" options for the Execution History tab —
 * one entry point serves both per-script and per-schedule variants via
 * {@link ExecutionOwnerScope}. Option building (incl. initiator-id → display-name
 * resolution) is delegated to {@link ScriptFilterOptionMapper}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ScriptExecutionFilterService {

    private final ScriptExecutionRepository scriptExecutionRepository;
    private final ScriptFilterOptionMapper optionMapper;
    private final TenantIdProvider tenantIdProvider;

    public ScriptExecutionFilters getExecutionFilters(ExecutionOwnerScope owner,
                                                      ScriptExecutionFilterInput input,
                                                      String search) {
        String tenantId = tenantIdProvider.getTenantId();
        ScriptExecutionQueryFilter filter = toQueryFilter(input);

        Map<String, Integer> initiators = scriptExecutionRepository.facet(tenantId, owner, filter, search, ExecutionFacetField.INITIATOR);
        Map<String, Integer> statuses = scriptExecutionRepository.facet(tenantId, owner, filter, search, ExecutionFacetField.STATUS);
        Map<String, Integer> machines = scriptExecutionRepository.facet(tenantId, owner, filter, search, ExecutionFacetField.MACHINE);
        long filteredCount = scriptExecutionRepository.count(tenantId, owner, filter, search);

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
                .dispatchedAtFrom(input.getDispatchedAtFrom())
                .dispatchedAtTo(input.getDispatchedAtTo())
                .build();
    }
}
