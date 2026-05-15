package com.openframe.sdk.tacticalrmm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class AssignedAgent {

    @JsonProperty("agent_id")
    private String agentId;

    private String hostname;

    private String plat;

    @JsonProperty("operating_system")
    private String operatingSystem;

    @JsonProperty("time_zone")
    private String timeZone;

    @JsonProperty("client_name")
    private String clientName;

    @JsonProperty("site_name")
    private String siteName;
}
