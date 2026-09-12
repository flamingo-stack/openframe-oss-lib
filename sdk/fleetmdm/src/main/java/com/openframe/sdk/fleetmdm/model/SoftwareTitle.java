package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class SoftwareTitle {

    private Long id;
    private String name;

    @JsonProperty("bundle_identifier")
    private String bundleIdentifier;

    private String source;

    private String browser;

    @JsonProperty("hosts_count")
    private Integer hostsCount;

    @JsonProperty("versions_count")
    private Integer versionsCount;

    private List<SoftwareTitleVersion> versions;

    @JsonProperty("counts_updated_at")
    private String countsUpdatedAt;
}
