package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class SoftwareTitleVersion {

    private Long id;
    private String version;

    private List<String> vulnerabilities;

    @JsonProperty("hosts_count")
    private Integer hostsCount;
}
