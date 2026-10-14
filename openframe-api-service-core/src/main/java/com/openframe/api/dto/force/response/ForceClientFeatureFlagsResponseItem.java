package com.openframe.api.dto.force.response;

import lombok.Data;

@Data
public class ForceClientFeatureFlagsResponseItem {

    private String machineId;
    private ForceAgentStatus status;
}
