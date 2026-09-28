package com.openframe.api.dto.rmm.software;

import com.openframe.api.dto.rmm.script.ScriptFilterOption;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SoftwareActionFilters {

    private List<ScriptFilterOption> statuses;
    private List<ScriptFilterOption> actions;
    private List<ScriptFilterOption> engines;
    private Integer filteredCount;
}
