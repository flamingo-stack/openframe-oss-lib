package com.openframe.sdk.tacticalrmm.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Body for POST /agents/&lt;agent_id&gt;/runscript/ — runs a saved script on an agent.
 * The {@code output} field controls how output is delivered: "wait" (return inline),
 * "email" (also requires emailMode/emails), or "collector" (also requires custom_field).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RunScriptRequest {

    @JsonProperty("script")
    private Integer script;

    @JsonProperty("output")
    private String output;

    @JsonProperty("args")
    private List<String> args;

    @JsonProperty("run_as_user")
    private Boolean runAsUser;

    @JsonProperty("env_vars")
    private List<String> envVars;

    @JsonProperty("timeout")
    private Integer timeout;

    @JsonProperty("run_on_server")
    private Boolean runOnServer;

    @JsonProperty("emailMode")
    private String emailMode;

    @JsonProperty("emails")
    private List<String> emails;

    @JsonProperty("custom_field")
    private Integer customField;

    public Integer getScript() { return script; }
    public void setScript(Integer script) { this.script = script; }

    public String getOutput() { return output; }
    public void setOutput(String output) { this.output = output; }

    public List<String> getArgs() { return args; }
    public void setArgs(List<String> args) { this.args = args; }

    public Boolean getRunAsUser() { return runAsUser; }
    public void setRunAsUser(Boolean runAsUser) { this.runAsUser = runAsUser; }

    public List<String> getEnvVars() { return envVars; }
    public void setEnvVars(List<String> envVars) { this.envVars = envVars; }

    public Integer getTimeout() { return timeout; }
    public void setTimeout(Integer timeout) { this.timeout = timeout; }

    public Boolean getRunOnServer() { return runOnServer; }
    public void setRunOnServer(Boolean runOnServer) { this.runOnServer = runOnServer; }

    public String getEmailMode() { return emailMode; }
    public void setEmailMode(String emailMode) { this.emailMode = emailMode; }

    public List<String> getEmails() { return emails; }
    public void setEmails(List<String> emails) { this.emails = emails; }

    public Integer getCustomField() { return customField; }
    public void setCustomField(Integer customField) { this.customField = customField; }
}
