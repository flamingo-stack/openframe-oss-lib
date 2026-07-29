package com.openframe.api.dto.rmm.schedulerun;

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
public class ScheduleRunFilters {

    private List<ScriptFilterOption> statuses;
    private List<ScriptFilterOption> initiators;
    private Integer filteredCount;
}
