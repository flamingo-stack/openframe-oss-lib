package com.openframe.sdk.tacticalrmm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Result model for Tactical RMM command execution
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class CommandResult {
    
    @JsonProperty("id")
    private String id;
    
    @JsonProperty("agent_id")
    private String agentId;
    
    @JsonProperty("stdout")
    private String stdout;
    
    @JsonProperty("stderr")
    private String stderr;
    
    @JsonProperty("return_code")
    private Integer returnCode;
    
    @JsonProperty("execution_time")
    private Double executionTime;
    
    @JsonProperty("timeout")
    private Integer timeout;
    
    @JsonProperty("shell")
    private String shell;
    
    @JsonProperty("command")
    private String command;
    
    @JsonProperty("status")
    private String status;
    
    @JsonProperty("date_run")
    private String dateRun;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getAgentId() {
        return agentId;
    }

    public void setAgentId(String agentId) {
        this.agentId = agentId;
    }

    public String getStdout() {
        return stdout;
    }

    public void setStdout(String stdout) {
        this.stdout = stdout;
    }

    public String getStderr() {
        return stderr;
    }

    public void setStderr(String stderr) {
        this.stderr = stderr;
    }

    public Integer getReturnCode() {
        return returnCode;
    }

    public void setReturnCode(Integer returnCode) {
        this.returnCode = returnCode;
    }

    public Double getExecutionTime() {
        return executionTime;
    }

    public void setExecutionTime(Double executionTime) {
        this.executionTime = executionTime;
    }

    public Integer getTimeout() {
        return timeout;
    }

    public void setTimeout(Integer timeout) {
        this.timeout = timeout;
    }

    public String getShell() {
        return shell;
    }

    public void setShell(String shell) {
        this.shell = shell;
    }

    public String getCommand() {
        return command;
    }

    public void setCommand(String command) {
        this.command = command;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getDateRun() {
        return dateRun;
    }

    public void setDateRun(String dateRun) {
        this.dateRun = dateRun;
    }

    /**
     * Helper method to check if command executed successfully
     */
    public boolean isSuccess() {
        return returnCode != null && returnCode == 0;
    }

    /**
     * Helper method to check if command timed out
     */
    public boolean isTimeout() {
        return "timeout".equalsIgnoreCase(status);
    }
}