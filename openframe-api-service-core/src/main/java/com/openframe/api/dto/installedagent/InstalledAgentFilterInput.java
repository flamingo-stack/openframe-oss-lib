package com.openframe.api.dto.installedagent;

import lombok.Data;

@Data
public class InstalledAgentFilterInput {
    private String machineId;
    private String agentType;
}

