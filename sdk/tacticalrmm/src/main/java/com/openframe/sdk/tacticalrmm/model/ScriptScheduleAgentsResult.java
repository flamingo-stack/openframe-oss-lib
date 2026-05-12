package com.openframe.sdk.tacticalrmm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Response from POST/DELETE/PUT /script-schedules/&lt;pk&gt;/agents/.
 * Reports the resulting agent count and how many TaskResult rows were synced
 * (created for newly assigned agents, deleted for unassigned).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScriptScheduleAgentsResult {

    @JsonProperty("agents_count")
    private Integer agentsCount;

    @JsonProperty("task_results_created")
    private Integer taskResultsCreated;

    @JsonProperty("task_results_deleted")
    private Integer taskResultsDeleted;

    public Integer getAgentsCount() { return agentsCount; }
    public void setAgentsCount(Integer agentsCount) { this.agentsCount = agentsCount; }

    public Integer getTaskResultsCreated() { return taskResultsCreated; }
    public void setTaskResultsCreated(Integer taskResultsCreated) { this.taskResultsCreated = taskResultsCreated; }

    public Integer getTaskResultsDeleted() { return taskResultsDeleted; }
    public void setTaskResultsDeleted(Integer taskResultsDeleted) { this.taskResultsDeleted = taskResultsDeleted; }
}
