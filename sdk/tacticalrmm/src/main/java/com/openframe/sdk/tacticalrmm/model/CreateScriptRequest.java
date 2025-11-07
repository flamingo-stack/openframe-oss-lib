package com.openframe.sdk.tacticalrmm.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Request model for creating a new script in Tactical RMM
 */
public class CreateScriptRequest {

    @JsonProperty("name")
    private String name;

    @JsonProperty("shell")
    private String shell;

    @JsonProperty("default_timeout")
    private Integer defaultTimeout;

    @JsonProperty("args")
    private List<String> args;

    @JsonProperty("script_body")
    private String scriptBody;

    @JsonProperty("run_as_user")
    private Boolean runAsUser;

    @JsonProperty("env_vars")
    private List<String> envVars;

    @JsonProperty("description")
    private String description;

    @JsonProperty("supported_platforms")
    private List<String> supportedPlatforms;

    @JsonProperty("category")
    private String category;

    public CreateScriptRequest() {
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getShell() {
        return shell;
    }

    public void setShell(String shell) {
        this.shell = shell;
    }

    public Integer getDefaultTimeout() {
        return defaultTimeout;
    }

    public void setDefaultTimeout(Integer defaultTimeout) {
        this.defaultTimeout = defaultTimeout;
    }

    public List<String> getArgs() {
        return args;
    }

    public void setArgs(List<String> args) {
        this.args = args;
    }

    public String getScriptBody() {
        return scriptBody;
    }

    public void setScriptBody(String scriptBody) {
        this.scriptBody = scriptBody;
    }

    public Boolean getRunAsUser() {
        return runAsUser;
    }

    public void setRunAsUser(Boolean runAsUser) {
        this.runAsUser = runAsUser;
    }

    public List<String> getEnvVars() {
        return envVars;
    }

    public void setEnvVars(List<String> envVars) {
        this.envVars = envVars;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public List<String> getSupportedPlatforms() {
        return supportedPlatforms;
    }

    public void setSupportedPlatforms(List<String> supportedPlatforms) {
        this.supportedPlatforms = supportedPlatforms;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    @Override
    public String toString() {
        return "CreateScriptRequest{" +
                "name='" + name + '\'' +
                ", shell='" + shell + '\'' +
                ", defaultTimeout=" + defaultTimeout +
                ", args=" + args +
                ", scriptBody='" + scriptBody + '\'' +
                ", runAsUser=" + runAsUser +
                ", envVars=" + envVars +
                ", description='" + description + '\'' +
                ", supportedPlatforms=" + supportedPlatforms +
                ", category='" + category + '\'' +
                '}';
    }
}

