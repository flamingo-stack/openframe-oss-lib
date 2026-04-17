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
public class RunScriptRequest {
    private String mode;
    private String target;
    private String monType;
    private String osType;
    private String cmd;
    private String shell;

    @JsonProperty("custom_shell")
    private String customShell;

    @JsonProperty("custom_field")
    private String customField;

    @JsonProperty("collector_all_output")
    private Boolean collectorAllOutput;

    @JsonProperty("save_to_agent_note")
    private Boolean saveToAgentNote;

    private String patchMode;
    private Boolean offlineAgents;
    private String client;
    private String site;
    private List<String> agents;
    private Integer script;
    private Integer timeout;
    private List<String> args;

    @JsonProperty("env_vars")
    private List<String> envVars;

    @JsonProperty("run_as_user")
    private Boolean runAsUser;
}
