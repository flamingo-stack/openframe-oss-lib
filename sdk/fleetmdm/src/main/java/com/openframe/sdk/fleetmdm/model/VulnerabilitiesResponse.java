package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Response wrapper for vulnerability list results from Fleet MDM
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class VulnerabilitiesResponse {

    private List<Vulnerability> vulnerabilities;

    private Long count;

    @JsonProperty("counts_updated_at")
    private String countsUpdatedAt;

    public List<Vulnerability> getVulnerabilities() {
        return vulnerabilities;
    }

    public void setVulnerabilities(List<Vulnerability> vulnerabilities) {
        this.vulnerabilities = vulnerabilities;
    }

    public Long getCount() {
        return count;
    }

    public void setCount(Long count) {
        this.count = count;
    }

    public String getCountsUpdatedAt() {
        return countsUpdatedAt;
    }

    public void setCountsUpdatedAt(String countsUpdatedAt) {
        this.countsUpdatedAt = countsUpdatedAt;
    }
}
