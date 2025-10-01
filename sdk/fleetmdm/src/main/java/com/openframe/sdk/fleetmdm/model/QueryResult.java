package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * Result model for Fleet MDM query execution via osquery
 */
@JsonIgnoreProperties(ignoreUnknown = true)  
public class QueryResult {
    
    @JsonProperty("host_id")
    private Long hostId;
    
    @JsonProperty("rows")
    private List<Map<String, Object>> rows;
    
    @JsonProperty("error")
    private String error;
    
    @JsonProperty("status")
    private String status;
    
    @JsonProperty("query")
    private String query;
    
    @JsonProperty("executed_at")
    private String executedAt;

    public Long getHostId() {
        return hostId;
    }

    public void setHostId(Long hostId) {
        this.hostId = hostId;
    }

    public List<Map<String, Object>> getRows() {
        return rows;
    }

    public void setRows(List<Map<String, Object>> rows) {
        this.rows = rows;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public String getExecutedAt() {
        return executedAt;
    }

    public void setExecutedAt(String executedAt) {
        this.executedAt = executedAt;
    }

    /**
     * Helper method to check if query executed successfully
     */
    public boolean isSuccess() {
        return error == null || error.isEmpty();
    }

    /**
     * Helper method to get the row count
     */
    public int getRowCount() {
        return rows != null ? rows.size() : 0;
    }
}