package com.openframe.sdk.tacticalrmm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TacticalScheduledTask {

    private Integer id;
    private String name;
    private boolean enabled;

    @JsonProperty("task_type")
    private String taskType;

    @JsonProperty("run_time_date")
    private String runTimeDate;

    @JsonProperty("daily_interval")
    private Integer dailyInterval;

    @JsonProperty("weekly_interval")
    private Integer weeklyInterval;

    @JsonProperty("run_time_bit_weekdays")
    private Integer runTimeBitWeekdays;

    @JsonProperty("task_supported_platforms")
    private List<String> taskSupportedPlatforms;

    @JsonProperty("actions_count")
    private Integer actionsCount;

    @JsonProperty("agents_count")
    private Integer agentsCount;

    @JsonProperty("managed_task_id")
    private Integer managedTaskId;

    private List<TaskAction> actions;

}
