package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Item in the read-only {@code hosts_include_any} list returned by
 * {@code GET /api/v1/fleet/policies/{id}} and {@code GET /api/v1/fleet/queries/{id}}
 * when Fleet is running in openframe mode.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class AssignedHost {

    @JsonProperty("id")
    private Long id;

    @JsonProperty("hostname")
    private String hostname;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getHostname() { return hostname; }
    public void setHostname(String hostname) { this.hostname = hostname; }
}
