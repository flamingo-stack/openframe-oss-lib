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

    // reported only by the OpenFrame Fleet, from its osquery programs table (fleetmdm#256); null elsewhere
    private String vendor;
    @JsonProperty("arp_key")
    private String arpKey;
    @JsonProperty("package_family_name")
    private String packageFamilyName;
    @JsonProperty("system_component")
    private Boolean systemComponent;
    @JsonProperty("installer_type")
    private String installerType;
    @JsonProperty("install_scope")
    private String installScope;
    @JsonProperty("install_arch")
    private String installArch;
}
