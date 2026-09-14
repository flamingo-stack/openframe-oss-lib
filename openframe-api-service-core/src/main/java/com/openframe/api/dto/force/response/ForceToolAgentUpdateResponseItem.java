package com.openframe.api.dto.force.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ForceToolAgentUpdateResponseItem {

    private String machineId;
    private String toolAgentId;
    private ForceAgentStatus status;

}
