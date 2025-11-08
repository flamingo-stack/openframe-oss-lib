package com.openframe.api.dto.force.response;

import lombok.Data;

@Data
public class ForceToolAgentInstallationResponseItem {

    private String machineId;
    private String toolAgentId;
    private ForceAgentStatus status;

}
