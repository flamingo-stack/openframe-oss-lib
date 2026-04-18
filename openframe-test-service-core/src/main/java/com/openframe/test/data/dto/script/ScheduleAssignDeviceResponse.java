package com.openframe.test.data.dto.script;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScheduleAssignDeviceResponse {

    @JsonProperty("agents_count")
    private Integer agentsCount;

    @JsonProperty("task_results_created")
    private Integer taskResultsCreated;

    @JsonProperty("task_results_deleted")
    private Integer taskResultsDeleted;
}
