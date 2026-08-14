package com.openframe.api.dto.force.response;

import lombok.Data;

@Data
public class ForceClientUninstallResponseItem {

    private String machineId;
    private ForceAgentStatus status;

}
