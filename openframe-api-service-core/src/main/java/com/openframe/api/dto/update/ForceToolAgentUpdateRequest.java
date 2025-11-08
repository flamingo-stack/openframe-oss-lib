package com.openframe.api.dto.update;

import lombok.Data;

import java.util.List;

@Data
public class ForceToolAgentUpdateRequest {

    private List<String> machineIds;
    private String toolAgentId;

}

