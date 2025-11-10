package com.openframe.data.model.nats;

import lombok.Data;

@Data
public class InstalledAgentMessage {

    private String machineId;
    private String agentType;
    private String version;

}

