package com.openframe.sdk.tacticalrmm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TacticalScript {

    private Integer id;
    private String name;
    private String description;
    private String shell;
    private List<String> args;
    private String category;

    @JsonProperty("script_body")
    private String scriptBody;

    @JsonProperty("default_timeout")
    private Integer defaultTimeout;

    @JsonProperty("supported_platforms")
    private List<String> supportedPlatforms;

    @JsonProperty("run_as_user")
    private Boolean runAsUser;

    @JsonProperty("env_vars")
    private List<String> envVars;
}
