package com.openframe.api.dto.rmm.script;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Available filter options (with live counts) for the scripts list — the Script
 * counterpart of {@code DeviceFilters}. Each list is a faceted set: computed with the
 * other active filters applied but not its own field, so a dropdown keeps offering
 * every switchable value. {@code filteredCount} is the total matching ALL active filters.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptFilters {

    private List<ScriptFilterOption> shells;
    private List<ScriptFilterOption> platforms;
    private List<ScriptFilterOption> authors;
    private Integer filteredCount;
}
