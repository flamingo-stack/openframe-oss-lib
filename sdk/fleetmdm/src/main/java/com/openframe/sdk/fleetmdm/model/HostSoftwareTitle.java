package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class HostSoftwareTitle {

    private Long id;
    private String name;
    private String source;

    @JsonProperty("installed_versions")
    private List<HostSoftwareInstalledVersion> installedVersions;
}
