package com.openframe.sdk.tacticalrmm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Agent list item model for Tactical RMM API responses (detail=false)
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class AgentListItem {
    
    @JsonProperty("id")
    private Integer id;
    
    @JsonProperty("agent_id")
    private String agentId;
    
    @JsonProperty("hostname")
    private String hostname;
    
    @JsonProperty("site")
    private String site;
    
    @JsonProperty("client")
    private String client;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    // Alias method for backward compatibility with cache service
    public Integer getPk() {
        return id;
    }

    public String getAgentId() {
        return agentId;
    }

    public void setAgentId(String agentId) {
        this.agentId = agentId;
    }

    public String getHostname() {
        return hostname;
    }

    public void setHostname(String hostname) {
        this.hostname = hostname;
    }

    public String getSite() {
        return site;
    }

    public void setSite(String site) {
        this.site = site;
    }

    public String getClient() {
        return client;
    }

    public void setClient(String client) {
        this.client = client;
    }

    @Override
    public String toString() {
        return "AgentListItem{" +
                "id=" + id +
                ", agentId='" + agentId + '\'' +
                ", hostname='" + hostname + '\'' +
                ", site='" + site + '\'' +
                ", client='" + client + '\'' +
                '}';
    }
}
