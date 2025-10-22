package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Query model from Fleet MDM representing a saved query or scheduled query
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class Query {
    
    private Long id;
    
    @JsonProperty("created_at")
    private String createdAt;
    
    @JsonProperty("updated_at")
    private String updatedAt;
    
    private String name;
    private String description;
    private String query;
    
    @JsonProperty("author_id")
    private Long authorId;
    
    @JsonProperty("author_name")
    private String authorName;
    
    @JsonProperty("author_email")
    private String authorEmail;
    
    @JsonProperty("observer_can_run")
    private Boolean observerCanRun;
    
    @JsonProperty("team_id")
    private Long teamId;
    
    @JsonProperty("team_name")
    private String teamName;
    
    private String platform;
    
    @JsonProperty("min_osquery_version")
    private String minOsqueryVersion;
    
    @JsonProperty("interval")
    private Integer interval;
    
    @JsonProperty("automations_enabled")
    private Boolean automationsEnabled;
    
    @JsonProperty("logging")
    private String logging;
    
    @JsonProperty("discard_data")
    private Boolean discardData;
    
    @JsonProperty("saved")
    private Boolean saved;
    
    @JsonProperty("stats")
    private QueryStats stats;

    // Getters and setters
    
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public Long getAuthorId() {
        return authorId;
    }

    public void setAuthorId(Long authorId) {
        this.authorId = authorId;
    }

    public String getAuthorName() {
        return authorName;
    }

    public void setAuthorName(String authorName) {
        this.authorName = authorName;
    }

    public String getAuthorEmail() {
        return authorEmail;
    }

    public void setAuthorEmail(String authorEmail) {
        this.authorEmail = authorEmail;
    }

    public Boolean getObserverCanRun() {
        return observerCanRun;
    }

    public void setObserverCanRun(Boolean observerCanRun) {
        this.observerCanRun = observerCanRun;
    }

    public Long getTeamId() {
        return teamId;
    }

    public void setTeamId(Long teamId) {
        this.teamId = teamId;
    }

    public String getTeamName() {
        return teamName;
    }

    public void setTeamName(String teamName) {
        this.teamName = teamName;
    }

    public String getPlatform() {
        return platform;
    }

    public void setPlatform(String platform) {
        this.platform = platform;
    }

    public String getMinOsqueryVersion() {
        return minOsqueryVersion;
    }

    public void setMinOsqueryVersion(String minOsqueryVersion) {
        this.minOsqueryVersion = minOsqueryVersion;
    }

    public Integer getInterval() {
        return interval;
    }

    public void setInterval(Integer interval) {
        this.interval = interval;
    }

    public Boolean getAutomationsEnabled() {
        return automationsEnabled;
    }

    public void setAutomationsEnabled(Boolean automationsEnabled) {
        this.automationsEnabled = automationsEnabled;
    }

    public String getLogging() {
        return logging;
    }

    public void setLogging(String logging) {
        this.logging = logging;
    }

    public Boolean getDiscardData() {
        return discardData;
    }

    public void setDiscardData(Boolean discardData) {
        this.discardData = discardData;
    }

    public Boolean getSaved() {
        return saved;
    }

    public void setSaved(Boolean saved) {
        this.saved = saved;
    }

    public QueryStats getStats() {
        return stats;
    }

    public void setStats(QueryStats stats) {
        this.stats = stats;
    }

    /**
     * Helper method to check if this query is scheduled to run
     */
    public boolean isScheduled() {
        return interval != null && interval > 0 && Boolean.TRUE.equals(automationsEnabled);
    }

    /**
     * Nested class for query statistics
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class QueryStats {
        
        @JsonProperty("user_time_p50")
        private Double userTimeP50;
        
        @JsonProperty("user_time_p95")
        private Double userTimeP95;
        
        @JsonProperty("system_time_p50")
        private Double systemTimeP50;
        
        @JsonProperty("system_time_p95")
        private Double systemTimeP95;
        
        @JsonProperty("total_executions")
        private Long totalExecutions;

        // Getters and setters
        
        public Double getUserTimeP50() {
            return userTimeP50;
        }

        public void setUserTimeP50(Double userTimeP50) {
            this.userTimeP50 = userTimeP50;
        }

        public Double getUserTimeP95() {
            return userTimeP95;
        }

        public void setUserTimeP95(Double userTimeP95) {
            this.userTimeP95 = userTimeP95;
        }

        public Double getSystemTimeP50() {
            return systemTimeP50;
        }

        public void setSystemTimeP50(Double systemTimeP50) {
            this.systemTimeP50 = systemTimeP50;
        }

        public Double getSystemTimeP95() {
            return systemTimeP95;
        }

        public void setSystemTimeP95(Double systemTimeP95) {
            this.systemTimeP95 = systemTimeP95;
        }

        public Long getTotalExecutions() {
            return totalExecutions;
        }

        public void setTotalExecutions(Long totalExecutions) {
            this.totalExecutions = totalExecutions;
        }
    }
}

