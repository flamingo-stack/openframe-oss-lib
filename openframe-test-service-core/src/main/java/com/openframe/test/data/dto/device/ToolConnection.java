package com.openframe.test.data.dto.device;

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
public class ToolConnection {
    private String id;
    private String machineId;
    private String toolType;
    private String agentToolId;
    private ConnectionStatus status;
    private String metadata;
    private String connectedAt;
    private String lastSyncAt;
    private String disconnectedAt;
}
