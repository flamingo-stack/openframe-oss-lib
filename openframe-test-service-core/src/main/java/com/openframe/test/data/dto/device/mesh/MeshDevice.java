package com.openframe.test.data.dto.device.mesh;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class MeshDevice {

    private String nodeId;
    private boolean online;
    private long lastConnectTime;
    private String lastConnectAddr;
}
