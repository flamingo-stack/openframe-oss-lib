package com.openframe.api.dto.toolinstallation;

import lombok.Data;

@Data
public class ForceToolInstallationResponseItem {

    private String machineId;
    private String toolAgentId;
    private ForceToolInstallationStatus status;

}
