package com.openframe.sdk.tacticalrmm.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CreateScriptScheduleRequest {

    private String name;

    @JsonProperty("task_type")
    private String taskType;

    @JsonProperty("run_time_date")
    private String runTimeDate;

    private Boolean enabled;

    @JsonProperty("run_time_bit_weekdays")
    private Integer runTimeBitWeekdays;

    @JsonProperty("weekly_interval")
    private Integer weeklyInterval;

    @JsonProperty("daily_interval")
    private Integer dailyInterval;

    @JsonProperty("task_supported_platforms")
    private List<String> taskSupportedPlatforms;

    private List<TaskAction> actions;
}
