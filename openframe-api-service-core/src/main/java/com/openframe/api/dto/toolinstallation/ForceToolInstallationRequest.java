package com.openframe.api.dto.toolinstallation;

import lombok.Data;

import java.util.List;

@Data
public class ForceToolInstallationRequest {

    private List<String> machineIds;
    private String toolAgentId;

}
