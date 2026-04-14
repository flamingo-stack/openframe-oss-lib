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
public class CreateScriptScheduleRequest {
    private String name;

    @JsonProperty("task_type")
    private String taskType;

    @JsonProperty("run_time_date")
    private String runTimeDate;

    @JsonProperty("task_supported_platforms")
    private List<String> taskSupportedPlatforms;

    private Boolean enabled;
    private List<Action> actions;

    @JsonProperty("daily_interval")
    private Integer dailyInterval;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Action {
        private String type;
        private Integer script;
        private String name;
        private Integer timeout;

        @JsonProperty("script_args")
        private List<String> scriptArgs;

        @JsonProperty("env_vars")
        private List<String> envVars;
    }
}
