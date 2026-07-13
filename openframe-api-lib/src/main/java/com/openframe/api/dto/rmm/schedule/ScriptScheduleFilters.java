package com.openframe.api.dto.rmm.schedule;

import com.openframe.api.dto.rmm.script.ScriptFilterOption;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Available filter options (with live counts) for the script-schedules list.
 * Each list is a faceted set: computed with the other active filters applied
 * but not its own field. {@code filteredCount} is the total matching ALL active
 * filters. Reuses {@link ScriptFilterOption} (value / label / count).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptScheduleFilters {

    private List<ScriptFilterOption> platforms;
    private List<ScriptFilterOption> authors;
    private Integer filteredCount;
}
