package com.openframe.api.dto.rmm.execution;

import com.openframe.api.dto.rmm.script.ScriptFilterOption;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Available filter options (with live counts) for one script's Execution History —
 * the executions counterpart of {@code ScriptFilters}. Currently exposes the
 * "Executed by" facet ({@code initiators}); {@code filteredCount} is the total
 * matching ALL active filters. Reuses {@link ScriptFilterOption} (value/label/count).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptExecutionFilters {

    private List<ScriptFilterOption> initiators;
    private List<ScriptFilterOption> statuses;
    private List<ScriptFilterOption> machines;
    private Integer filteredCount;
}
