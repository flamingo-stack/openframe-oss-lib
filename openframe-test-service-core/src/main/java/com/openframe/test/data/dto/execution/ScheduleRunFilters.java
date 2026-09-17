package com.openframe.test.data.dto.execution;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.shared.FilterOption;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScheduleRunFilters {
    private List<FilterOption> statuses;
    private List<FilterOption> initiators;
    private Integer filteredCount;
}
