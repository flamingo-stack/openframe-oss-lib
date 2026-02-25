package com.openframe.data.model.nats;

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

}