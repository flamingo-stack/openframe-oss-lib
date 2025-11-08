package com.openframe.api.dto.update;

import lombok.Data;

@Data
public class ForceToolAgentUpdateResponse {

    private String toolAgentId;
    private String machineId;
    private ForceUpdateStatus status;

}

