package com.openframe.api.dto.force.response;

import lombok.Data;

@Data
public class ForceClientUpdateResponseItem {

    private String machineId;
    private ForceAgentStatus status;

}
