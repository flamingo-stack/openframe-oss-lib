package com.openframe.sdk.tacticalrmm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Response from POST /agents/&lt;agent_id&gt;/runscript/ when {@code output=wait}.
 * For {@code output=email|collector} the response is a confirmation string and
 * fields are not populated.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class RunScriptResult {

    @JsonProperty("stdout")
    private String stdout;

    @JsonProperty("stderr")
    private String stderr;

    @JsonProperty("execution_time")
    private String executionTime;

    @JsonProperty("retcode")
    private Integer retcode;

    private String agentId;
    private Integer scriptId;

    public String getStdout() { return stdout; }
    public void setStdout(String stdout) { this.stdout = stdout; }

    public String getStderr() { return stderr; }
    public void setStderr(String stderr) { this.stderr = stderr; }

    public String getExecutionTime() { return executionTime; }
    public void setExecutionTime(String executionTime) { this.executionTime = executionTime; }

    public Integer getRetcode() { return retcode; }
    public void setRetcode(Integer retcode) { this.retcode = retcode; }

    public String getAgentId() { return agentId; }
    public void setAgentId(String agentId) { this.agentId = agentId; }

    public Integer getScriptId() { return scriptId; }
    public void setScriptId(Integer scriptId) { this.scriptId = scriptId; }

    public boolean isSuccess() {
        return retcode != null && retcode == 0;
    }
}
