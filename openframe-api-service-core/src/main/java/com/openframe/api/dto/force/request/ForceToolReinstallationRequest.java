package com.openframe.api.dto.force.request;

import lombok.Data;

import java.util.List;

@Data
public class ForceToolReinstallationRequest {

    private List<String> machineIds;
    private String toolAgentId;

}

