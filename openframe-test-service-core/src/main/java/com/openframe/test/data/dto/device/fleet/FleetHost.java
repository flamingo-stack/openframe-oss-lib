package com.openframe.test.data.dto.device.fleet;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Collections;
import java.util.List;


@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class FleetHost {

    // Hardware
    @JsonProperty("computer_name")
    private String computerName;

    @JsonProperty("hardware_vendor")
    private String hardwareVendor;

    @JsonProperty("hardware_model")
    private String hardwareModel;

    @JsonProperty("hardware_serial")
    private String hardwareSerial;

    @JsonProperty("cpu_type")
    private String cpuType;

    @JsonProperty("cpu_subtype")
    private String cpuSubtype;

    @JsonProperty("cpu_brand")
    private String cpuBrand;

    @JsonProperty("cpu_physical_cores")
    private int cpuPhysicalCores;

    @JsonProperty("cpu_logical_cores")
    private int cpuLogicalCores;

    private long memory;
    private long uptime;

    @JsonProperty("gigs_total_disk_space")
    private double gigsTotalDiskSpace;

    // Network
    @JsonProperty("primary_ip")
    private String primaryIp;

    @JsonProperty("primary_mac")
    private String primaryMac;

    // Users
    private List<FleetUser> users;

    // Software
    private List<FleetSoftware> software;

    public List<FleetVulnerability> getVulnerabilities() {
        if (software == null) {
            return Collections.emptyList();
        }
        return software.stream()
                .filter(s -> s.getVulnerabilities() != null)
                .flatMap(s -> s.getVulnerabilities().stream()
                        .map(v -> FleetVulnerability.builder()
                                .cve(v.getCve())
                                .detailsLink(v.getDetailsLink())
                                .createdAt(v.getCreatedAt())
                                .softwareName(s.getName())
                                .build()))
                .toList();
    }
}
