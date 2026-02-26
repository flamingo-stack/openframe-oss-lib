package com.openframe.data.nats.model;

import lombok.Data;

@Data
public class InstalledAgentMessage {

    private String machineId;
    private String agentType;
    private String version;

}

