package com.openframe.data.nats.model;

import lombok.Data;

@Data
public class UserInstalledAgentMessage {

    private String agentType;
    private String version;

}
