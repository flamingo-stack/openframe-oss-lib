package com.openframe.data.nats.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class DownloadConfiguration {

    private String os;
    private String fileName;
    @JsonProperty("agentFileName")
    private String targetFileName;
    private String link;
    private InstallationType installationType = InstallationType.STANDARD;
    private String bundleId;
    private String serviceName;
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private String minOsVersion;

}