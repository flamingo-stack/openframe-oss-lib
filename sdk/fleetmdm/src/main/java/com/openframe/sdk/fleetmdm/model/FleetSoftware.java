package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

/**
 * Software installed on a Fleet host, including any matched vulnerabilities.
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class FleetSoftware {

    private Long id;
    private String name;
    private String version;
    private String source;
    private String vendor;
    private List<FleetVulnerability> vulnerabilities;
}
