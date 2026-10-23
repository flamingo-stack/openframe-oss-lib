package com.openframe.test.data.dto.schedule;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.shared.FilterOption;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Faceted filter options returned by {@code scriptScheduleFilters(filter)}: the platforms and
 * authors present among the matching schedules, each with a count, plus the matching total.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScriptScheduleFilters {
    private List<FilterOption> platforms;
    private List<FilterOption> authors;
    private Integer filteredCount;
}
