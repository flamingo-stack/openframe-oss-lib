package com.openframe.api.dto.toolinstallation;

import lombok.Data;

@Data
public class ForceToolAgentResponseItem {

    private String machineId;
    private String toolAgentId;
    private ForceAgentStatus status;

}
