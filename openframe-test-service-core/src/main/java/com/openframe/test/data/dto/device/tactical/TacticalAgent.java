package com.openframe.test.data.dto.device.tactical;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TacticalAgent {

    private String status;

    @JsonProperty("agent_id")
    private String agentId;

    private String hostname;

    @JsonProperty("operating_system")
    private String operatingSystem;

    private String plat;
    private String goarch;
    private String version;

    @JsonProperty("cpu_model")
    private List<String> cpuModel;

    @JsonProperty("make_model")
    private String makeModel;

    @JsonProperty("physical_disks")
    private List<String> physicalDisks;

    private String graphics;

    @JsonProperty("local_ips")
    private String localIps;

    @JsonProperty("public_ip")
    private String publicIp;

    @JsonProperty("total_ram")
    private int totalRam;

    @JsonProperty("monitoring_type")
    private String monitoringType;

    private String timezone;
}
