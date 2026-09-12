package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AffectedSoftware {

    private Long id;
    private String name;
    private String source;
    private String version;
    private String browser;

    @JsonProperty("hosts_count")
    private Integer hostsCount;

    @JsonProperty("generated_cpe")
    private String generatedCpe;

    @JsonProperty("resolved_in_version")
    private String resolvedInVersion;
}
