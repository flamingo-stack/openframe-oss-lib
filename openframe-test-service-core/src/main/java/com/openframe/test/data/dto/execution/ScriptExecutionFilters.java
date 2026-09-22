package com.openframe.test.data.dto.execution;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.shared.FilterOption;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Facets of the execution-history panel: initiators, statuses, machines, plus the matching total. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScriptExecutionFilters {
    private List<FilterOption> initiators;
    private List<FilterOption> statuses;
    private List<FilterOption> machines;
    private Integer filteredCount;
}
