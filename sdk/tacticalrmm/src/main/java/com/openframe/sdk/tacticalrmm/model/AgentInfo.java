package com.openframe.sdk.tacticalrmm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Agent information model for Tactical RMM API responses
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class AgentInfo {
    
    @JsonProperty("agent_id")
    private String agentId;
    
    @JsonProperty("plat")
    private String platform;
    
    @JsonProperty("operating_system") 
    private String operatingSystem;
    
    @JsonProperty("hostname")
    private String hostname;

    public String getAgentId() {
        return agentId;
    }

    public void setAgentId(String agentId) {
        this.agentId = agentId;
    }

    public String getPlatform() {
        return platform;
    }

    public void setPlatform(String platform) {
        this.platform = platform;
    }

    public String getOperatingSystem() {
        return operatingSystem;
    }

    public void setOperatingSystem(String operatingSystem) {
        this.operatingSystem = operatingSystem;
    }

    public String getHostname() {
        return hostname;
    }

    public void setHostname(String hostname) {
        this.hostname = hostname;
    }

    @Override
    public String toString() {
        return "AgentInfo{" +
                "agentId='" + agentId + '\'' +
                ", platform='" + platform + '\'' +
                ", operatingSystem='" + operatingSystem + '\'' +
                ", hostname='" + hostname + '\'' +
                '}';
    }
}