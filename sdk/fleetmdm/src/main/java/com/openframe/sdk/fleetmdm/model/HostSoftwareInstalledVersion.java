package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class HostSoftwareInstalledVersion {

    private String version;
    private List<String> vulnerabilities;

    // reported only by the OpenFrame Fleet, from its osquery programs table (fleetmdm#256); null elsewhere. The ARP key
    // and installer are this host's own: the same program sits under other keys on other hosts
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

    // the winget package id, on rows from the osquery winget_packages table only (fleetmdm#259)
    @JsonProperty("winget_id")
    private String wingetId;
}
