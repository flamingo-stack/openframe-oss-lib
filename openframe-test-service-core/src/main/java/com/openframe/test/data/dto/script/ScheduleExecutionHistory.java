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
public class ScheduleExecutionHistory {
    private Integer total;
    private Integer limit;
    private Integer offset;
    private List<Result> results;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Result {
        private Integer id;

        @JsonProperty("agent_id")
        private String agentId;

        @JsonProperty("agent_hostname")
        private String agentHostname;

        @JsonProperty("agent_platform")
        private String agentPlatform;

        private String organization;
        private Integer retcode;
        private String stdout;
        private String stderr;

        @JsonProperty("execution_time")
        private String executionTime;

        @JsonProperty("last_run")
        private String lastRun;

        private String status;

        @JsonProperty("sync_status")
        private String syncStatus;
    }
}
