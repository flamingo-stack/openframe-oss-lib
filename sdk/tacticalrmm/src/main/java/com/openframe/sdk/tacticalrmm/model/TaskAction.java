package com.openframe.sdk.tacticalrmm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TaskAction {
    private String type;
    private String name;
    private Integer script;
    private Integer timeout;

    @JsonProperty("run_as_user")
    private Boolean runAsUser;

    @JsonProperty("script_args")
    private List<String> scriptArgs;

    @JsonProperty("env_vars")
    private List<String> envVars;
}
