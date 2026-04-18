package com.openframe.test.data.dto.script;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
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
public class ScriptSchedule {
    private Integer id;
    private String name;

    @JsonProperty("task_type")
    private String taskType;

    @JsonProperty("run_time_date")
    private String runTimeDate;

    private Boolean enabled;

    @JsonProperty("task_supported_platforms")
    private List<String> taskSupportedPlatforms;

    @JsonProperty("actions_count")
    private Integer actionsCount;

    @JsonProperty("agents_count")
    private Integer agentsCount;
}
